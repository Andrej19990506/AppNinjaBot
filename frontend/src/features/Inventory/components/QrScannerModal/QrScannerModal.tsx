import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import styles from './QrScannerModal.module.css';

interface QrScannerModalProps {
    onClose: () => void;
    onDetected: (code: string) => void;
}

declare global {
    interface Window {
        ImageCapture?: new (track: MediaStreamTrack) => ImageCapture;
    }
}

interface PhotoCapabilities {
    fillLightMode?: string[];
}

interface ImageCapture {
    getPhotoCapabilities(): Promise<PhotoCapabilities>;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ onClose, onDetected }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const decodeTimeoutRef = useRef<number | null>(null);
    const isDecodingRef = useRef(false);
    const hintsRef = useRef<Map<DecodeHintType, unknown> | null>(null);
    const scanDelayRef = useRef(140);
    const brightnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const brightnessContextRef = useRef<CanvasRenderingContext2D | null>(null);
    const brightnessHintShownRef = useRef(false);
    const decodeFallbackWarnedRef = useRef(false);
    const isActiveRef = useRef(true);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const imageCaptureRef = useRef<ImageCapture | null>(null);
    const autoFocusIntervalRef = useRef<number | null>(null);
    const devicesRef = useRef<MediaDeviceInfo[]>([]);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('qr-preferred-device') ?? undefined;
        }
        return undefined;
    });
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [successCode, setSuccessCode] = useState<string | null>(null);
    const initialFocusDoneRef = useRef(false);
    const focusAttemptedRef = useRef(false);
    const hasStartedRef = useRef(false);
    const currentDeviceIdRef = useRef<string | undefined>(undefined);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const reticlePositions = useMemo(() => ([
        { x: 0, y: 0 },
        { x: 10, y: -6 },
        { x: -12, y: 8 },
        { x: 14, y: 10 },
        { x: -14, y: -10 },
    ]), []);
    const [reticleStep, setReticleStep] = useState(0);
    const [reticleOffset, setReticleOffset] = useState(reticlePositions[0]);
    const reticleTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isScanning) {
            if (reticleTimerRef.current) {
                window.clearInterval(reticleTimerRef.current);
                reticleTimerRef.current = null;
            }
            setReticleOffset({ x: 0, y: 0 });
            return;
        }

        if (reticleTimerRef.current) {
            window.clearInterval(reticleTimerRef.current);
        }
        setReticleStep(0);
        setReticleOffset(reticlePositions[0]);

        reticleTimerRef.current = window.setInterval(() => {
            setReticleStep(prev => {
                const next = (prev + 1) % reticlePositions.length;
                setReticleOffset(reticlePositions[next]);
                return next;
            });
        }, 900);

        return () => {
            if (reticleTimerRef.current) {
                window.clearInterval(reticleTimerRef.current);
                reticleTimerRef.current = null;
            }
        };
    }, [isScanning, reticlePositions]);

    const pushLog = useCallback((message: string) => {
        setDebugLogs(prev => {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const entry = `${timestamp} - ${message}`;
            const next = [...prev, entry];
            return next.length > 25 ? next.slice(next.length - 25) : next;
        });
    }, []);

    const clearLogs = useCallback(() => {
        setDebugLogs([]);
    }, []);

    const copyLogs = useCallback(async () => {
        if (!debugLogs.length) return;
        const text = debugLogs.join('\n');
        try {
            await navigator.clipboard.writeText(text);
            pushLog('Логи скопированы в буфер обмена');
        } catch (err) {
            pushLog(`Не удалось скопировать логи: ${String(err)}`);
        }
    }, [debugLogs, pushLog]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const audio = new Audio('/sounds/scanner.mp3');
        audio.preload = 'auto';
        audioRef.current = audio;
        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        pushLog('Окно сканирования открыто');
        return () => {
            pushLog('Окно сканирования закрыто');
        };
    }, [pushLog]);

    useEffect(() => {
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        hintsRef.current = hints;
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        brightnessCanvasRef.current = canvas;
        brightnessContextRef.current = ctx;
        return () => {
            brightnessCanvasRef.current = null;
            brightnessContextRef.current = null;
        };
    }, []);

    const [statusMessage, setStatusMessage] = useState('Ищем QR-код...');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [canUseTorch, setCanUseTorch] = useState(false);
    useEffect(() => {
        canUseTorchRef.current = canUseTorch;
    }, [canUseTorch]);
    useEffect(() => {
        torchStateRef.current = isTorchOn;
    }, [isTorchOn]);
    const canUseTorchRef = useRef(false);
    const torchStateRef = useRef(false);

    const stopDecoding = useCallback((options?: { reset?: boolean }) => {
        if (decodeTimeoutRef.current) {
            window.clearTimeout(decodeTimeoutRef.current);
            decodeTimeoutRef.current = null;
        }
        isDecodingRef.current = false;
        if (options?.reset && readerRef.current) {
            try {
                readerRef.current.reset();
            } catch (err) {
                console.debug('[QR Scanner] Ошибка сброса ZXing:', err);
            }
        }
    }, []);

    const stopStream = useCallback((options?: { silent?: boolean }) => {
        stopDecoding({ reset: true });
        setIsScanning(false);
        if (autoFocusIntervalRef.current) {
            clearInterval(autoFocusIntervalRef.current);
            autoFocusIntervalRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            if (!options?.silent) {
                pushLog('Камера остановлена');
            }
        }
        hasStartedRef.current = false;
        if (!options?.silent) {
            setSuccessCode(null);
        }
    }, [pushLog, stopDecoding]);

    const triggerAutoFocus = useCallback(async (withHint = false) => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track?.applyConstraints) return;
        if (track.readyState !== 'live') {
            if (withHint) {
                pushLog('Трек камеры еще не готов к автофокусу');
            }
            return;
        }
        if (withHint) {
            setStatusMessage('Подстраиваем фокус...');
            pushLog('Вручную запущен автофокус пользователем');
        }
        try {
            await (track as any).applyConstraints({
                advanced: [{ focusMode: 'continuous' }],
            });
        } catch (err) {
            try {
                await (track as any).applyConstraints({
                    advanced: [{ focusMode: 'auto' }],
                });
            } catch (innerErr) {
                console.debug('[QR Scanner] Не удалось изменить фокус:', innerErr);
            }
        }
        if (withHint) {
            setTimeout(() => setStatusMessage('Ищем QR-код...'), 600);
        }
        if (!initialFocusDoneRef.current) {
            initialFocusDoneRef.current = true;
            pushLog('Автофокус активирован');
        }
    }, [pushLog]);

    const configureTrackForFocus = useCallback(async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        if (focusAttemptedRef.current) {
            return;
        }

        const capabilities = typeof track.getCapabilities === 'function' ? (track.getCapabilities() as any) : undefined;
        console.log('[QR Scanner] video capabilities:', capabilities);
        pushLog(`Камера capabilities → focus:${Array.isArray(capabilities?.focusMode) ? capabilities.focusMode.join('/') : 'нет'}, zoom:${capabilities?.zoom ? `${capabilities.zoom.min ?? 0}-${capabilities.zoom.max ?? 0}` : 'нет'}`);

        const constraintSets: MediaTrackConstraintSet[] = [];

        if (Array.isArray(capabilities?.focusMode) && capabilities.focusMode.length > 0) {
            const mode = capabilities.focusMode.includes('continuous')
                ? 'continuous'
                : capabilities.focusMode.includes('single-shot')
                    ? 'single-shot'
                    : capabilities.focusMode[0];
            constraintSets.push({ ...( { focusMode: mode } as any ) });
        }

        const focusDistanceCaps = capabilities?.focusDistance;
        if (focusDistanceCaps && typeof focusDistanceCaps.min === 'number' && typeof focusDistanceCaps.max === 'number' && focusDistanceCaps.max > focusDistanceCaps.min) {
            const mid = capabilities.focusDistance.min + (capabilities.focusDistance.max - capabilities.focusDistance.min) / 2;
            constraintSets.push({ ...( { focusDistance: mid } as any ) });
        }

        const zoomCaps = capabilities?.zoom;
        if (zoomCaps && typeof zoomCaps.max === 'number') {
            const targetZoom = Math.min(zoomCaps.max, Math.max(zoomCaps.min ?? 1, 1.8));
            if (!Number.isNaN(targetZoom)) {
                constraintSets.push({ ...( { zoom: targetZoom } as any ) });
            }
        }

        if (constraintSets.length) {
            try {
                await track.applyConstraints({ advanced: constraintSets as any });
                pushLog('Применены настройки фокуса/зума');
            } catch (err) {
                console.warn('[QR Scanner] Не удалось применить настройки фокуса/зума:', err);
                pushLog(`Не удалось применить настройки фокуса: ${String(err)}`);
            }
        } else {
            pushLog('Камера не предоставляет настройки фокуса/зума');
        }
        focusAttemptedRef.current = true;
    }, [pushLog]);

    const sampleBrightness = useCallback((): number | null => {
        const video = videoRef.current;
        const canvas = brightnessCanvasRef.current;
        const ctx = brightnessContextRef.current;
        if (!video || !canvas || !ctx || video.videoWidth === 0 || video.videoHeight === 0) {
            return null;
        }

        const size = canvas.width;
        const side = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - side) / 2;
        const sy = (video.videoHeight - side) / 2;

        try {
            ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
            const { data } = ctx.getImageData(0, 0, size, size);
            let sum = 0;
            for (let i = 0; i < data.length; i += 4) {
                sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }
            return sum / (size * size);
        } catch (err) {
            console.debug('[QR Scanner] Не удалось измерить яркость кадра:', err);
            return null;
        }
    }, []);

    const handleDetectionSuccess = useCallback((payload: string) => {
        if (!payload || !isActiveRef.current) {
            return;
        }
        isActiveRef.current = false;
        stopDecoding();
        setIsScanning(false);
        setReticleOffset({ x: 0, y: 0 });
        setStatusMessage('Код считан');
        setSuccessCode(payload);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => undefined);
        }
        const short = payload.length > 80 ? `${payload.slice(0, 80)}...` : payload;
        pushLog(`Код считан: ${short}`);
        brightnessHintShownRef.current = false;
        onDetected(payload);
    }, [onDetected, pushLog, stopDecoding]);

    const ensureReader = useCallback(() => {
        if (!readerRef.current) {
            readerRef.current = new BrowserMultiFormatReader(hintsRef.current ?? undefined);
        }
        if (readerRef.current && hintsRef.current) {
            try {
                const readerAny = readerRef.current as unknown as { setHints?: (hints: Map<DecodeHintType, unknown>) => void };
                readerAny.setHints?.(hintsRef.current as Map<DecodeHintType, unknown>);
            } catch (err) {
                console.debug('[QR Scanner] Не удалось обновить подсказки ZXing:', err);
            }
        }
        return readerRef.current;
    }, []);

    const decodeLoop = useCallback(async () => {
        if (!isActiveRef.current || !videoRef.current) {
            return;
        }
        if (isDecodingRef.current) {
            return;
        }

        const reader = ensureReader();
        const videoEl = videoRef.current;
        if (!reader || !videoEl) {
            return;
        }

        if (videoEl.readyState < 2) {
            if (decodeTimeoutRef.current) {
                window.clearTimeout(decodeTimeoutRef.current);
            }
            decodeTimeoutRef.current = window.setTimeout(() => decodeLoop(), scanDelayRef.current);
            return;
        }

        isDecodingRef.current = true;
        try {
            const brightness = sampleBrightness();
            if (brightness !== null) {
                if (brightness < 55 && canUseTorchRef.current && !torchStateRef.current && !brightnessHintShownRef.current) {
                    brightnessHintShownRef.current = true;
                    setStatusMessage('Темно - включите фонарик для лучшего сканирования');
                    pushLog('Освещенность низкая (<55), рекомендуем включить фонарик');
                } else if (brightness >= 70 && brightnessHintShownRef.current) {
                    brightnessHintShownRef.current = false;
                    setStatusMessage('Ищем QR-код...');
                }
            }

            const readerAny = reader as any;
            const decodeOnce = typeof readerAny.decodeOnceFromVideoElement === 'function'
                ? readerAny.decodeOnceFromVideoElement.bind(readerAny)
                : null;
            let decodedText: string | undefined;
            if (decodeOnce) {
                const result = await decodeOnce(videoEl, hintsRef.current ?? undefined);
                if (result && typeof result.getText === 'function') {
                    decodedText = result.getText().trim();
                }
            } else if (!decodeFallbackWarnedRef.current) {
                decodeFallbackWarnedRef.current = true;
                pushLog('Метод decodeOnceFromVideoElement недоступен, обновите библиотеку ZXing');
            }

            if (decodedText) {
                handleDetectionSuccess(decodedText);
                return;
            }
        } catch (err) {
            if ((err as any)?.name !== 'NotFoundException') {
                console.warn('[QR Scanner][ZXing] Ошибка распознавания:', err);
                pushLog(`ZXing ошибка: ${String(err)}`);
            }
        } finally {
            isDecodingRef.current = false;
            if (isActiveRef.current) {
                if (decodeTimeoutRef.current) {
                    window.clearTimeout(decodeTimeoutRef.current);
                }
                decodeTimeoutRef.current = window.setTimeout(() => decodeLoop(), scanDelayRef.current);
            }
        }
    }, [ensureReader, handleDetectionSuccess, pushLog, sampleBrightness]);

    const startCamera = useCallback(
        async (deviceId?: string) => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorMessage('Браузер не позволяет использовать камеру. Попробуйте другой браузер или устройство.');
                pushLog('getUserMedia не поддерживается');
                return;
            }

            try {
                const targetId = deviceId;
                if (hasStartedRef.current) {
                    if (currentDeviceIdRef.current === targetId) {
                        pushLog('Камера уже активна, переинициализация не требуется');
                        return;
                    }
                    stopStream({ silent: true });
                }

                setSuccessCode(null);
                focusAttemptedRef.current = false;
                initialFocusDoneRef.current = false;
                setCanUseTorch(false);
                setIsTorchOn(false);

                setStatusMessage('Открываем камеру...');
                pushLog(`Пробуем открыть камеру: ${targetId ?? 'по умолчанию'}`);

                const baseConstraints: MediaStreamConstraints = {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 },
                    },
                };

                if (targetId) {
                    (baseConstraints.video as MediaTrackConstraints).deviceId = { exact: targetId };
                }

                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(baseConstraints);
                } catch (err) {
                    console.warn('[QR Scanner] Не удалось запустить выбранную камеру, пробуем без deviceId', err);
                    pushLog(`Не удалось запустить выбранную камеру: ${String(err)}. Пробуем параметры по умолчанию.`);
                    const fallbackConstraints: MediaStreamConstraints = {
                        video: {
                            facingMode: 'environment',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                            frameRate: { ideal: 30 },
                        },
                    };
                    stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                }

                streamRef.current = stream;
                const appliedDeviceId = targetId ?? stream.getVideoTracks()[0]?.getSettings()?.deviceId;
                currentDeviceIdRef.current = appliedDeviceId;
                if (!targetId && appliedDeviceId) {
                    setSelectedDeviceId(prev => prev ?? appliedDeviceId);
                }
                hasStartedRef.current = true;
                pushLog('Камера успешно открыта');

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    try {
                        await videoRef.current.play();
                    } catch (err) {
                        console.warn('[QR Scanner] Ошибка запуска воспроизведения видео:', err);
                        pushLog(`Видео не удалось воспроизвести: ${String(err)}`);
                    }
                }

                await configureTrackForFocus();
                await triggerAutoFocus();

                if (autoFocusIntervalRef.current) {
                    clearInterval(autoFocusIntervalRef.current);
                }
                autoFocusIntervalRef.current = window.setInterval(() => {
                    triggerAutoFocus();
                }, 2500);

                const track = stream.getVideoTracks()[0];
                if ('ImageCapture' in window && track && track.readyState === 'live') {
                    try {
                        const capture = new (window as any).ImageCapture(track);
                        imageCaptureRef.current = capture;
                        const capabilities = await capture.getPhotoCapabilities();
                        if (capabilities.fillLightMode?.includes('flash')) {
                            setCanUseTorch(true);
                            pushLog('Фонарик доступен');
                        }
                    } catch (torchErr) {
                        console.warn('[QR Scanner] Фонарик недоступен:', torchErr);
                        pushLog(`Фонарик недоступен: ${String(torchErr)}`);
                    }
                }

                brightnessHintShownRef.current = false;
                setStatusMessage('Ищем QR-код...');
                setIsScanning(true);
                isActiveRef.current = true;
                decodeLoop();
            } catch (error) {
                console.error('[QR Scanner] Ошибка при доступе к камере:', error);
                setErrorMessage('Не удалось получить доступ к камере. Проверьте разрешения.');
                pushLog(`Ошибка доступа к камере: ${String(error)}`);
            }
        },
        [configureTrackForFocus, decodeLoop, pushLog, stopStream, triggerAutoFocus]
    );

    useEffect(() => {
        isActiveRef.current = true;
        return () => {
            isActiveRef.current = false;
            stopStream({ silent: true });
        };
    }, [stopStream]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (cancelled) return;
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                devicesRef.current = videoInputs;
                setAvailableCameras(videoInputs);
                pushLog(`Найдено камер: ${videoInputs.length}`);
                if (videoInputs.length > 0) {
                    setSelectedDeviceId(prev => {
                        if (prev) {
                            currentDeviceIdRef.current = prev;
                            return prev;
                        }
                        const preferred = videoInputs.find(device => device.label.toLowerCase().includes('back')) ?? videoInputs[0];
                        pushLog(`Выбрана камера по умолчанию: ${preferred.label || preferred.deviceId}`);
                        currentDeviceIdRef.current = preferred.deviceId;
                        return preferred.deviceId;
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn('[QR Scanner] Не удалось получить список камер:', err);
                    pushLog(`Ошибка получения списка камер: ${String(err)}`);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [pushLog]);

    useEffect(() => {
        if (!selectedDeviceId) return;
        startCamera(selectedDeviceId);
    }, [selectedDeviceId, startCamera]);

    const toggleTorch = useCallback(async () => {
        if (!canUseTorch || !imageCaptureRef.current) return;
        try {
            const track = streamRef.current?.getVideoTracks()[0];
            if (!track || track.readyState !== 'live') {
                pushLog('Фонарик недоступен: поток неактивен');
                return;
            }
            await (track as any).applyConstraints({ advanced: [{ torch: !isTorchOn }] });
            setIsTorchOn(prev => !prev);
            pushLog(`Фонарик ${!isTorchOn ? 'включен' : 'выключен'}`);
        } catch (err) {
            console.warn('[QR Scanner] Не удалось переключить фонарик:', err);
            pushLog(`Ошибка переключения фонарика: ${String(err)}`);
        }
    }, [canUseTorch, isTorchOn, pushLog]);

    const handleClose = useCallback(() => {
        isActiveRef.current = false;
        setSuccessCode(null);
        stopStream();
        onClose();
    }, [onClose, stopStream]);

    const handleGallerySelect = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
            pushLog('Открыт выбор изображения из галереи');
        }
    }, [pushLog]);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }
        setStatusMessage('Загрузка из галереи пока недоступна.');
        event.target.value = '';
        pushLog('Выбор файла из галереи недоступен (не реализовано)');
    }, [pushLog]);

    const handleCameraChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value || undefined;
        setSelectedDeviceId(value);
        if (typeof window !== 'undefined') {
            if (value) {
                localStorage.setItem('qr-preferred-device', value);
            } else {
                localStorage.removeItem('qr-preferred-device');
            }
        }
        const found = devicesRef.current.find(device => device.deviceId === value);
        pushLog(`Выбрана камера пользователем: ${found?.label || value || 'по умолчанию'}`);
    }, [pushLog]);

    const handleSuccessContinue = useCallback(() => {
        setSuccessCode(null);
        brightnessHintShownRef.current = false;

        const track = streamRef.current?.getVideoTracks()[0];
        if (!track || track.readyState !== 'live') {
            pushLog('Видеопоток завершен - переоткрываем камеру');
            startCamera(currentDeviceIdRef.current);
            return;
        }

        if (videoRef.current?.paused) {
            videoRef.current.play().catch(() => undefined);
        }

        setStatusMessage('Ищем QR-код...');
        setIsScanning(true);
        stopDecoding();
        isActiveRef.current = true;
        decodeLoop();
        triggerAutoFocus(true).catch(() => undefined);
    }, [decodeLoop, pushLog, startCamera, stopDecoding, triggerAutoFocus]);

    const successShort = successCode
        ? successCode.length > 160
            ? `${successCode.slice(0, 160)}...`
            : successCode
        : '';

    return (
        <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className={styles.scannerContainer}>
                <header className={styles.headerBar}>
                    <button className={styles.headerButton} onClick={handleClose} aria-label="Назад">
                        <ArrowBackIcon />
                    </button>

                    <div className={styles.headerCenter}>
                        <span className={styles.headerTitle}>Сканирование QR</span>
                        {availableCameras.length > 0 && (
                            <select
                                className={styles.cameraSelect}
                                value={selectedDeviceId ?? ''}
                                onChange={handleCameraChange}
                            >
                                {availableCameras.map((device, index) => (
                                    <option key={device.deviceId || index} value={device.deviceId}>
                                        {device.label || `Камера ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <button
                        className={`${styles.headerButton} ${!canUseTorch ? styles.headerButtonDisabled : ''}`}
                        onClick={toggleTorch}
                        aria-label="Переключить фонарик"
                        disabled={!canUseTorch}
                    >
                        <FlashOnIcon color={isTorchOn ? 'warning' : 'inherit'} />
                    </button>
                </header>

                <div className={styles.videoWrapper}>
                    {errorMessage ? (
                        <div className={styles.errorBlock}>{errorMessage}</div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                className={styles.video}
                                playsInline
                                muted
                                onClick={() => triggerAutoFocus(true)}
                            />
                            <div className={styles.videoGlow} />
                            <div
                                className={`${styles.reticle} ${isScanning ? styles.reticleScanning : styles.reticleLocked}`}
                                style={
                                    {
                                        '--reticle-offset-x': `${reticleOffset.x}%`,
                                        '--reticle-offset-y': `${reticleOffset.y}%`,
                                    } as React.CSSProperties
                                }
                            >
                                <div className={styles.scanBeam} />
                            </div>
                        </>
                    )}
                </div>

                <footer className={styles.footerBar}>
                    <div className={styles.floatingIcon} aria-hidden="true" />
                    <p className={styles.status}>{errorMessage ? 'Попробуйте позже' : statusMessage}</p>

                    {debugLogs.length > 0 && (
                        <div className={styles.debugPanel}>
                            <div className={styles.debugTitle}>Отладка</div>
                            {debugLogs.map((log, index) => (
                                <div key={index} className={styles.debugItem}>{log}</div>
                            ))}
                            <div className={styles.debugActions}>
                                <button type="button" className={styles.debugButton} onClick={clearLogs}>
                                    Очистить
                                </button>
                                <button type="button" className={styles.debugButton} onClick={copyLogs}>
                                    Скопировать
                                </button>
                            </div>
                        </div>
                    )}

                    <button className={styles.galleryButton} onClick={handleGallerySelect} type="button">
                        Выбрать из галереи
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.hiddenInput}
                        onChange={handleFileChange}
                    />
                </footer>
                {successCode && (
                    <div className={styles.successOverlay}>
                        <div className={styles.successTitle}>QR-код считан</div>
                        <div className={styles.successCode}>{successShort}</div>
                        <div className={styles.debugActions}>
                            <button type="button" className={styles.successButton} onClick={handleSuccessContinue}>
                                Сканировать ещё
                            </button>
                            <button type="button" className={styles.successButton} onClick={handleClose}>
                                Закрыть
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default QrScannerModal;