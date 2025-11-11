import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { BrowserMultiFormatReader } from '@zxing/browser';
import styles from './QrScannerModal.module.css';

interface QrScannerModalProps {
    onClose: () => void;
    onDetected: (code: string) => void;
}

interface BarcodeDetectorInstance {
    detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
}

declare global {
    interface Window {
        BarcodeDetector?: {
            new (options?: { formats?: string[] }): BarcodeDetectorInstance;
        };
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
    const animationFrameRef = useRef<number | null>(null);
    const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
    const isActiveRef = useRef(true);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const fallbackReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const fallbackActiveRef = useRef(false);
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
    const lastDetectorErrorRef = useRef<string | null>(null);
    const lastFallbackErrorRef = useRef<string | null>(null);
    const initialFocusDoneRef = useRef(false);

    const pushLog = useCallback((message: string) => {
        setDebugLogs(prev => {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const entry = `${timestamp} — ${message}`;
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
        pushLog('Окно сканирования открыто');
        return () => {
            pushLog('Окно сканирования закрыто');
        };
    }, [pushLog]);

    const [statusMessage, setStatusMessage] = useState('Наведите камеру на QR-код');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [canUseTorch, setCanUseTorch] = useState(false);

    const stopFallbackReader = useCallback(() => {
        if (fallbackReaderRef.current) {
            pushLog('Останавливаем fallback ZXing');
            try {
                fallbackReaderRef.current.reset();
            } catch (err) {
                console.debug('[QR Scanner] reset fallback reader failed (ignored):', err);
                pushLog(`Не удалось корректно сбросить fallback: ${String(err)}`);
            }
            fallbackReaderRef.current = null;
        }
        fallbackActiveRef.current = false;
    }, [pushLog]);

    const stopStream = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        stopFallbackReader();

        if (autoFocusIntervalRef.current) {
            clearInterval(autoFocusIntervalRef.current);
            autoFocusIntervalRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            pushLog('Камера остановлена');
        }
    }, [pushLog, stopFallbackReader]);

    const triggerAutoFocus = useCallback(async (withHint = false) => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track?.applyConstraints) return;
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
            setTimeout(() => setStatusMessage('Наведите камеру на QR-код'), 600);
        }
        if (!initialFocusDoneRef.current) {
            initialFocusDoneRef.current = true;
            pushLog('Автофокус активирован');
        }
    }, [pushLog]);

    const configureTrackForFocus = useCallback(async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;

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
        }
    }, [pushLog]);

    const handleDetectionSuccess = useCallback((payload: string) => {
        if (!payload || !isActiveRef.current) {
            return;
        }
        isActiveRef.current = false;
        setStatusMessage('Код считан');
        stopFallbackReader();
        stopStream();
        const short = payload.length > 80 ? `${payload.slice(0, 80)}…` : payload;
        pushLog(`Код считан: ${short}`);
        lastDetectorErrorRef.current = null;
        lastFallbackErrorRef.current = null;
        onDetected(payload);
    }, [onDetected, pushLog, stopFallbackReader, stopStream]);

    const startFallbackReader = useCallback(() => {
        if (fallbackActiveRef.current || !videoRef.current) {
            return;
        }

        try {
            const reader = new BrowserMultiFormatReader();
            fallbackReaderRef.current = reader;
            fallbackActiveRef.current = true;
            setStatusMessage('Используем усиленный режим сканирования...');
            pushLog('Запускаем fallback ZXing');
 
            const videoEl = videoRef.current;
            if (!videoEl) {
                return;
            }

            if (typeof reader.decodeFromVideoDevice === 'function') {
                reader.decodeFromVideoDevice(
                    selectedDeviceId,
                    videoEl,
                    (result: unknown, error: unknown) => {
                        if (!isActiveRef.current) {
                            return;
                        }

                        if (result && typeof (result as any)?.getText === 'function') {
                            const text = (result as any).getText().trim();
                            if (text) {
                                handleDetectionSuccess(text);
                            }
                            return;
                        }

                        if (error && (error as any)?.name !== 'NotFoundException') {
                            console.warn('[QR Scanner][ZXing] Ошибка распознавания:', error);
                            const msg = String(error);
                            if (lastFallbackErrorRef.current !== msg) {
                                lastFallbackErrorRef.current = msg;
                                pushLog(`ZXing ошибка: ${msg}`);
                            }
                        }
                    }
                );
            } else {
                console.error('[QR Scanner] decodeFromVideoDevice не поддерживается в используемой версии ZXing');
                pushLog('decodeFromVideoDevice не поддерживается этой версией ZXing');
            }
        } catch (err) {
            console.error('[QR Scanner] Не удалось запустить fallback-сканер:', err);
            pushLog(`Не удалось запустить fallback-сканер: ${String(err)}`);
        }
    }, [handleDetectionSuccess, pushLog, selectedDeviceId]);

    const detectLoop = useCallback(async () => {
        if (!isActiveRef.current) {
            return;
        }

        if (!detectorRef.current || !videoRef.current) {
            if (!fallbackActiveRef.current) {
                startFallbackReader();
            }
            animationFrameRef.current = requestAnimationFrame(detectLoop);
            return;
        }
 
        try {
            const results = await detectorRef.current.detect(videoRef.current);
            if (results.length > 0) {
                const payload = results[0]?.rawValue?.trim();
                if (payload) {
                    handleDetectionSuccess(payload);
                    return;
                }
            } else {
                // no-op
            }
        } catch (err) {
            console.error('[QR Scanner] Ошибка при распознавании:', err);
            const msg = String(err);
            if (lastDetectorErrorRef.current !== msg) {
                lastDetectorErrorRef.current = msg;
                pushLog(`BarcodeDetector ошибка: ${msg}`);
            }
        }
 
        animationFrameRef.current = requestAnimationFrame(detectLoop);
    }, [handleDetectionSuccess, pushLog, startFallbackReader]);

    const loadCameraDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            devicesRef.current = videoInputs;
            setAvailableCameras(videoInputs);
            pushLog(`Найдено камер: ${videoInputs.length}`);

            if (!selectedDeviceId && videoInputs.length > 0) {
                const preferred = videoInputs.find(device => device.label.toLowerCase().includes('back')) ?? videoInputs[0];
                setSelectedDeviceId(preferred.deviceId);
                pushLog(`Выбрана камера по умолчанию: ${preferred.label || preferred.deviceId}`);
            }
        } catch (err) {
            console.warn('[QR Scanner] Не удалось получить список камер:', err);
            pushLog(`Ошибка получения списка камер: ${String(err)}`);
        }
    }, [pushLog, selectedDeviceId]);

    useEffect(() => {
        isActiveRef.current = true;
 
         if (!navigator.mediaDevices?.getUserMedia) {
             setErrorMessage('Браузер не позволяет использовать камеру. Попробуйте другой браузер или устройство.');
             return;
         }
 
        const startCamera = async () => {
            try {
                setStatusMessage('Открываем камеру...');
                // fallback state reset happens in stopFallbackReader
 
                const baseConstraints: MediaStreamConstraints = {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 },
                    },
                };

                if (selectedDeviceId) {
                    (baseConstraints.video as MediaTrackConstraints).deviceId = { exact: selectedDeviceId };
                }

                pushLog(`Пробуем открыть камеру: ${selectedDeviceId ?? 'по умолчанию'}`);
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
                initialFocusDoneRef.current = false;
                lastDetectorErrorRef.current = null;
                lastFallbackErrorRef.current = null;
                pushLog('Камера успешно открыта');
 
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
 
                await loadCameraDevices();
 
                await configureTrackForFocus();
                await triggerAutoFocus();

                if (autoFocusIntervalRef.current) {
                    clearInterval(autoFocusIntervalRef.current);
                }
                autoFocusIntervalRef.current = window.setInterval(() => {
                    triggerAutoFocus();
                }, 2500);

                // Проверяем поддержку фонарика
                const track = stream.getVideoTracks()[0];
                if ('ImageCapture' in window && track) {
                    try {
                        const capture = new ImageCapture(track);
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

                if (window.BarcodeDetector) {
                    detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
                    setStatusMessage('Наведите камеру на QR-код');
                    animationFrameRef.current = requestAnimationFrame(detectLoop);
                    pushLog('Используем встроенный BarcodeDetector');
                } else {
                    setStatusMessage('Используем резервный сканер...');
                    startFallbackReader();
                }
            } catch (error) {
                console.error('[QR Scanner] Ошибка при доступе к камере:', error);
                setErrorMessage('Не удалось получить доступ к камере. Проверьте разрешения.');
                pushLog(`Ошибка доступа к камере: ${String(error)}`);
            }
        };
 
        startCamera();
 
        return () => {
            isActiveRef.current = false;
            stopStream();
        };
    }, [configureTrackForFocus, detectLoop, loadCameraDevices, pushLog, selectedDeviceId, startFallbackReader, stopStream, triggerAutoFocus]);

    const toggleTorch = useCallback(async () => {
        if (!canUseTorch || !imageCaptureRef.current) return;
        try {
            const track = streamRef.current?.getVideoTracks()[0];
            if (!track) return;
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
                            <video ref={videoRef} className={styles.video} playsInline muted onClick={() => triggerAutoFocus(true)} />
                            <div className={styles.videoGlow} />
                            <div className={styles.reticle}>
                                <div className={styles.corner} />
                                <div className={styles.corner} />
                                <div className={styles.corner} />
                                <div className={styles.corner} />
                            </div>
                        </>
                    )}
                </div>

                <footer className={styles.footerBar}>
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
            </div>
        </motion.div>
    );
};
