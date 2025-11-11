import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlashOnIcon from '@mui/icons-material/FlashOn';
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

    const [statusMessage, setStatusMessage] = useState('Наведите камеру на QR-код');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [canUseTorch, setCanUseTorch] = useState(false);
    const imageCaptureRef = useRef<ImageCapture | null>(null);

    const stopStream = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const detectLoop = useCallback(async () => {
        if (!detectorRef.current || !videoRef.current || !isActiveRef.current) {
            return;
        }

        try {
            const results = await detectorRef.current.detect(videoRef.current);
            if (results.length > 0) {
                const payload = results[0]?.rawValue?.trim();
                if (payload) {
                    isActiveRef.current = false;
                    setStatusMessage('Код считан');
                    stopStream();
                    onDetected(payload);
                    return;
                }
            }
        } catch (err) {
            console.error('[QR Scanner] Ошибка при распознавании:', err);
        }

        animationFrameRef.current = requestAnimationFrame(detectLoop);
    }, [onDetected, stopStream]);

    useEffect(() => {
        isActiveRef.current = true;

        if (!navigator.mediaDevices?.getUserMedia) {
            setErrorMessage('Браузер не позволяет использовать камеру. Попробуйте другой браузер или устройство.');
            return;
        }

        const start = async () => {
            try {
                setStatusMessage('Открываем камеру...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                });

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // Проверяем поддержку фонарика
                const track = stream.getVideoTracks()[0];
                if ('ImageCapture' in window && track) {
                    try {
                        const capture = new ImageCapture(track);
                        imageCaptureRef.current = capture;
                        const capabilities = await capture.getPhotoCapabilities();
                        if (capabilities.fillLightMode?.includes('flash')) {
                            setCanUseTorch(true);
                        }
                    } catch (torchErr) {
                        console.warn('[QR Scanner] Фонарик недоступен:', torchErr);
                    }
                }

                if (window.BarcodeDetector) {
                    detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
                    setStatusMessage('Наведите камеру на QR-код');
                    animationFrameRef.current = requestAnimationFrame(detectLoop);
                } else {
                    setErrorMessage('Сканер QR не поддерживается этим браузером. Используйте Chrome/Edge на Android или нативное приложение.');
                }
            } catch (error) {
                console.error('[QR Scanner] Ошибка при доступе к камере:', error);
                setErrorMessage('Не удалось получить доступ к камере. Проверьте разрешения.');
            }
        };

        start();

        return () => {
            isActiveRef.current = false;
            stopStream();
        };
    }, [detectLoop, stopStream]);

    const toggleTorch = useCallback(async () => {
        if (!canUseTorch || !imageCaptureRef.current) return;
        try {
            const track = streamRef.current?.getVideoTracks()[0];
            if (!track) return;
            await (track as any).applyConstraints({ advanced: [{ torch: !isTorchOn }] });
            setIsTorchOn(prev => !prev);
        } catch (err) {
            console.warn('[QR Scanner] Не удалось переключить фонарик:', err);
        }
    }, [canUseTorch, isTorchOn]);

    const handleGallerySelect = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }
        setStatusMessage('Загрузка из галереи пока недоступна.');
        event.target.value = '';
    }, []);

    return (
        <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className={styles.scannerContainer}>
                <header className={styles.headerBar}>
                    <button className={styles.headerButton} onClick={onClose} aria-label="Назад">
                        <ArrowBackIcon />
                    </button>

                    <span className={styles.headerTitle}>Сканирование QR</span>

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
                            <video ref={videoRef} className={styles.video} playsInline muted />
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
