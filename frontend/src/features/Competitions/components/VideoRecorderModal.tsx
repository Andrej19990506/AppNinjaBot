import React, { useEffect, useRef, useState } from 'react';
import { axiosInstance } from '@/shared/api/api';

interface VideoRecorderModalProps {
    onClose: () => void;
    userId: number;
    firstName: string;
    lastName: string;
    competitionId: number;
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(30,30,30,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 0,
};

const modalStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    maxWidth: '100vw',
    maxHeight: '100vh',
    background: 'var(--card-background)',
    borderRadius: 0,
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 0,
    overflow: 'hidden',
};

const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--card-background)',
    border: '1.5px solid var(--primary-color)',
    borderRadius: 'var(--radius-lg)',
    width: 'auto',
    height: 40,
    fontSize: 16,
    color: 'var(--primary-color)',
    cursor: 'pointer',
    zIndex: 10,
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    opacity: 0.98,
    padding: '0 20px',
    marginRight: '10px',
};

const cameraSwitchBtnStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 24,
    left: 'calc(60% + 80px)',
    background: 'var(--card-background)',
    border: '1.5px solid var(--primary-color)',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: 18,
    color: 'var(--primary-color)',
    cursor: 'pointer',
    zIndex: 10,
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    opacity: 0.98,
};

const videoContainerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--background-color)',
    position: 'relative',
    overflow: 'hidden',
};

const videoStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    objectFit: 'cover',
    background: '#000',
    borderRadius: 0,
};

const startBtnStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    fontSize: 22,
    fontWeight: 700,
    padding: '18px 48px',
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
    zIndex: 5,
    transition: 'all var(--transition-fast)',
    outline: 'none',
};

const animatedCountdownStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 80,
    fontWeight: 900,
    color: 'var(--primary-color)',
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 32,
    padding: '24px 48px',
    zIndex: 20,
    textShadow: '0 2px 16px rgba(0,0,0,0.18)',
    opacity: 0.97,
    transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
    pointerEvents: 'none',
};

const timerStyleCenter: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    borderRadius: 24,
    padding: '16px 48px',
    fontSize: 48,
    fontWeight: 900,
    boxShadow: 'var(--shadow)',
    zIndex: 21,
    letterSpacing: 2,
    opacity: 0.98,
    transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)',
};

const timerStyleCorner: React.CSSProperties = {
    position: 'absolute',
    top: 45,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    borderRadius: 16,
    padding: '4px 18px',
    fontSize: 20,
    fontWeight: 700,
    boxShadow: 'var(--shadow-md)',
    zIndex: 22,
    letterSpacing: 1,
    opacity: 0.98,
    border: 'none',
    minWidth: 56,
    textAlign: 'center',
    userSelect: 'none',
    transition: 'background 0.2s',
};

const restartBtnStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 24,
    left: 'calc(30% - 80px)', // Позиционируем слева от кнопки "Закрыть"
    background: 'var(--card-background)',
    border: '1.5px solid var(--primary-color)',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: 18,
    color: 'var(--primary-color)',
    cursor: 'pointer',
    zIndex: 10,
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    opacity: 0.98,
};

const statusStyle: React.CSSProperties = {
    position: 'absolute',
    top: 95,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--success-background)',
    color: 'var(--success-color)',
    borderRadius: 16,
    padding: '8px 24px',
    fontSize: 20,
    fontWeight: 600,
    boxShadow: 'var(--shadow)',
    zIndex: 6,
    opacity: 0.95,
    textAlign: 'center',
};

const resultModalStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--card-background)',
    color: 'var(--primary-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '48px 32px 32px 32px',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 320,
    maxWidth: '90vw',
    textAlign: 'center',
    animation: 'fadeInScale 0.5s cubic-bezier(0.4,0,0.2,1)',
};

const okBtnStyle: React.CSSProperties = {
    marginTop: 32,
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 20,
    fontWeight: 700,
    padding: '14px 48px',
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    outline: 'none',
};

const confirmModalStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--card-background)',
    color: 'var(--primary-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '36px 28px 28px 28px',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '90vw',
    textAlign: 'center',
    animation: 'fadeInScale 0.3s cubic-bezier(0.4,0,0.2,1)',
};
const confirmBtnRow: React.CSSProperties = {
    display: 'flex',
    gap: 18,
    marginTop: 28,
};
const confirmBtn: React.CSSProperties = {
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 18,
    fontWeight: 700,
    padding: '10px 32px',
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    outline: 'none',
};
const confirmBtnCancel: React.CSSProperties = {
    ...confirmBtn,
    background: 'var(--card-background)',
    color: 'var(--primary-color)',
    border: '1.5px solid var(--primary-color)',
};

const finishModalStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--card-background)',
    color: 'var(--primary-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '44px 32px 32px 32px',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 340,
    maxWidth: 420,
    width: '90vw',
    textAlign: 'center',
    animation: 'fadeInScale 0.4s cubic-bezier(0.4,0,0.2,1)',
};
const finishBtnRow: React.CSSProperties = {
    display: 'flex',
    gap: 18,
    marginTop: 28,
    flexWrap: 'wrap',
    justifyContent: 'center',
};
const finishBtn: React.CSSProperties = {
    background: 'var(--primary-color)',
    color: 'var(--text-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 18,
    fontWeight: 700,
    padding: '12px 32px',
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    outline: 'none',
    marginBottom: 8,
};
const finishBtnAlt: React.CSSProperties = {
    ...finishBtn,
    background: 'var(--card-background)',
    color: 'var(--primary-color)',
    border: '1.5px solid var(--primary-color)',
};

const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({ onClose, userId, firstName, lastName, competitionId }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [timer, setTimer] = useState<number>(10); // 10 секунд для быстрого тестирования
    const [countdown, setCountdown] = useState<number | null>(null);
    const [showTimerCenter, setShowTimerCenter] = useState(false);
    const [showTimerCorner, setShowTimerCorner] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState<string | number>('');
    const [countdownAnim, setCountdownAnim] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [chunks] = useState<Blob[]>([]);
    const [showResultModal, setShowResultModal] = useState(false);
    const [hasRecorded, setHasRecorded] = useState(false);
    const [showConfirmRestart, setShowConfirmRestart] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const welcomeAudioSrc = '/sounds/Genny_Untitled_Google_Chrome_2025_07_29_01_53_48_V2.mp3';
    const audioSrc = '/sounds/Blondie_-_One_way_or_another_(SkySound.cc).mp3';
    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioStarted, setAudioStarted] = useState(false);
    let audioTimeout: NodeJS.Timeout;
    const audioWelcomeRef = useRef<HTMLAudioElement>(null);
    const [isWelcomePlaying, setIsWelcomePlaying] = useState(false);
    const startSoundSrc = '/sounds/Start.mp3';
    const audioStartRef = useRef<HTMLAudioElement>(null);
    const endSoundSrc = '/sounds/END.mp3';
    const audioEndRef = useRef<HTMLAudioElement>(null);
    const [endSoundPlayed, setEndSoundPlayed] = useState(false);
    const [finalCountdown, setFinalCountdown] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isFrontCamera, setIsFrontCamera] = useState(true);

    // Функция переключения камеры
    const switchCamera = async () => {
        try {
            if (stream) {
                // Останавливаем текущий стрим
                stream.getTracks().forEach(track => track.stop());
            }

            // Получаем список доступных камер
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length < 2) {
                console.log('Доступна только одна камера');
                return;
            }

            // Переключаем на другую камеру
            const newFacingMode = isFrontCamera ? 'environment' : 'user';
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: true
            });

            setStream(newStream);
            setIsFrontCamera(!isFrontCamera);

            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (err) {
            console.error('Ошибка переключения камеры:', err);
        }
    };

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((mediaStream) => {
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            })
            .catch((err) => {
                setError('Не удалось получить доступ к камере: ' + err.message);
            });
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Анимированный отсчёт 3-2-1-GO
    const startPreCountdown = () => {
        setShowCountdown(true);
        setCountdownAnim(true);
        let seq = [3, 2, 1, 'GO'];
        let i = 0;
        setCountdownValue(seq[i]);
        // Проигрываем звук только один раз при старте отсчёта
        if (audioStartRef.current) {
            audioStartRef.current.currentTime = 0;
            audioStartRef.current.play();
        }
        const interval = setInterval(() => {
            i++;
            if (i < seq.length) {
                setCountdownAnim(false);
                setTimeout(() => {
                    setCountdownValue(seq[i]);
                    setCountdownAnim(true);
                }, 100);
            } else {
                clearInterval(interval);
                setShowCountdown(false);
                setShowTimerCenter(true);
                setTimeout(() => {
                    setShowTimerCenter(false);
                    setShowTimerCorner(true);
                    startRecording();
                }, 1200); // 1.2 сек таймер по центру
            }
        }, 900);
    };

    // После окончания приветствия запускаем отсчёт
    useEffect(() => {
        if (!isWelcomePlaying) return;
        const audio = audioWelcomeRef.current;
        if (!audio) return;
        const onEnded = () => {
            setIsWelcomePlaying(false);
            startPreCountdown();
        };
        audio.addEventListener('ended', onEnded);
        return () => audio.removeEventListener('ended', onEnded);
    }, [isWelcomePlaying]);

    // Таймер обратного отсчёта для записи
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (recording && timer > 0) {
            setCountdown(timer);
            interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev && prev > 1) {
                        return prev - 1;
                    } else {
                        clearInterval(interval);
                        stopRecording();
                        return 0;
                    }
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [recording, timer]);

    // useEffect для проигрывания END.mp3 и финального отсчёта
    useEffect(() => {
        if (!recording || countdown === null) return;
        // END.mp3 за 1:55 (115 секунд)
        if (countdown === 115 && !endSoundPlayed) {
            if (audioEndRef.current) {
                audioEndRef.current.currentTime = 0;
                audioEndRef.current.play();
                setEndSoundPlayed(true);
            }
        }
        // Финальный отсчёт 5-4-3-2-1
        if (countdown <= 5 && countdown > 0) {
            setFinalCountdown(countdown);
        } else {
            setFinalCountdown(null);
        }
    }, [countdown, recording, endSoundPlayed]);

    const startRecording = () => {
        if (!stream) return;
        setRecording(true);
        setCountdown(timer);
        setHasRecorded(false);
        setAudioStarted(false);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };
        mediaRecorder.onstop = () => {
            // Здесь будет отправка видео на Google Drive (следующий шаг)
            // const blob = new Blob(chunks, { type: 'video/webm' });
            setHasRecorded(true);
        };
        mediaRecorder.start();
        // Запуск песни через 1.5 секунды
        audioTimeout = setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
                setAudioStarted(true);
            }
        }, 1500);
    };

    // Сброс звука при рестарте/остановке — больше не нужен для audioStartRef
    const stopRecording = (showResult = true) => {
        setRecording(false);
        setCountdown(null);
        setShowTimerCorner(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setAudioStarted(false);
        clearTimeout(audioTimeout);
        if (showResult) {
            setTimeout(() => {
                setShowFinishModal(true);
            }, 500);
        }
    };

    const restartRecording = () => {
        stopRecording(false); // не показываем результат
        setTimeout(() => {
            setHasRecorded(false);
            setShowCountdown(false);
            setShowTimerCenter(false);
            setShowTimerCorner(false);
            setCountdown(null);
            setRecording(false);
            setCountdownValue('');
            setCountdownAnim(false);
            chunks.length = 0; // сбрасываем видео
            setEndSoundPlayed(false);
        }, 300);
    };

    const handleRestartClick = () => {
        setShowConfirmRestart(true);
    };
    const handleConfirmRestart = () => {
        setShowConfirmRestart(false);
        restartRecording();
    };
    const handleCancelRestart = () => {
        setShowConfirmRestart(false);
    };

    // Заготовка функции отправки видео на сервер
    const uploadVideo = async () => {
        setIsUploading(true);
        setUploadError(null);
        try {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('video', blob, 'competition_video.webm');
            formData.append('user_id', String(userId));
            formData.append('first_name', firstName);
            formData.append('last_name', lastName);
            formData.append('competition_id', String(competitionId));
            
            const response = await axiosInstance.post(`/v1/competitions/${competitionId}/upload_video`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            if (response.status !== 201) throw new Error('Ошибка загрузки видео');
            setShowResultModal(true);
        } catch (e: any) {
            setUploadError(e.message || 'Ошибка загрузки');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFinishSave = () => {
        setShowFinishModal(false);
        setTimeout(() => {
            uploadVideo();
        }, 200);
    };
    const handleFinishRetry = () => {
        setShowFinishModal(false);
        setTimeout(() => {
            restartRecording();
        }, 200);
    };
    const handleResultRetry = () => {
        setShowResultModal(false);
        setTimeout(() => {
            restartRecording();
        }, 200);
    };

    const handleStartClick = () => {
        if (audioWelcomeRef.current) {
            setIsWelcomePlaying(true);
            audioWelcomeRef.current.currentTime = 0;
            audioWelcomeRef.current.play();
        }
    };

    // Форматирование времени для таймера
    const formatTime = (sec: number | null) => {
        if (sec === null) return '';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <button style={closeBtnStyle} onClick={onClose} title="Закрыть" disabled={isWelcomePlaying}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Закрыть
                </button>
                <button style={cameraSwitchBtnStyle} onClick={switchCamera} title="Переключить камеру">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                </button>
                <audio ref={audioWelcomeRef} src={welcomeAudioSrc} preload="auto" />
                <audio ref={audioRef} src={audioSrc} preload="auto" />
                <audio ref={audioStartRef} src={startSoundSrc} preload="auto" />
                <audio ref={audioEndRef} src={endSoundSrc} preload="auto" />
                <div style={videoContainerStyle}>
                    {error ? (
                        <div style={{ color: 'red', fontSize: 20 }}>{error}</div>
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
                            {/* Анимированный отсчёт */}
                            {showCountdown && (
                                <div
                                    style={{
                                        ...animatedCountdownStyle,
                                        opacity: countdownAnim ? 1 : 0.3,
                                        transform: countdownAnim
                                            ? 'translate(-50%, -50%) scale(1)'
                                            : 'translate(-50%, -50%) scale(0.7)',
                                    }}
                                >
                                    {countdownValue}
                                </div>
                            )}
                            {/* Таймер по центру */}
                            {showTimerCenter && (
                                <div style={timerStyleCenter}>5:00</div>
                            )}
                            {/* Таймер в углу */}
                            {showTimerCorner && (
                                <div style={timerStyleCorner}>{formatTime(countdown)}</div>
                            )}
                            {/* Кнопка начать заново во время записи */}
                            {recording && (
                                <button style={restartBtnStyle} onClick={handleRestartClick} title="Начать заново">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8" />
                                        <polyline points="20 4 20 8 16 8" />
                                    </svg>
                                </button>
                            )}
                            {showConfirmRestart && (
                                <div style={confirmModalStyle}>
                                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 18, color: 'var(--primary-color)' }}>
                                        Вы точно хотите начать заново?
                                    </div>
                                    <div style={confirmBtnRow}>
                                        <button style={confirmBtn} onClick={handleConfirmRestart}>Да</button>
                                        <button style={confirmBtnCancel} onClick={handleCancelRestart}>Нет</button>
                                    </div>
                                </div>
                            )}
                            {showFinishModal && (
                                <div style={finishModalStyle}>
                                    <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 18, color: 'var(--primary-color)' }}>
                                        Конкурс окончен!
                                    </div>
                                    <div style={{ fontSize: 20, color: 'var(--text-color)', marginBottom: 12 }}>
                                        Сохранить результат?
                                    </div>
                                    {isUploading ? (
                                        <div style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: 18, margin: '24px 0' }}>Загрузка видео...</div>
                                    ) : (
                                        <>
                                            {uploadError && <div style={{ color: 'var(--error-color)', marginBottom: 10 }}>{uploadError}</div>}
                                            <div style={finishBtnRow}>
                                                <button style={finishBtn} onClick={handleFinishSave}>Сохранить результат</button>
                                                <button style={finishBtnAlt} onClick={handleFinishRetry}>Попробовать ещё раз</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {/* Кнопка старта */}
                            {!showCountdown && !showTimerCenter && !showTimerCorner && !recording && !showResultModal && !showFinishModal && !isWelcomePlaying && (
                                <button style={startBtnStyle} onClick={handleStartClick}>
                                    Начать запись
                                </button>
                            )}
                            {/* Блокируем кнопки во время приветствия */}
                            {isWelcomePlaying && (
                                <div style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.65)',
                                    color: 'var(--primary-color)',
                                    borderRadius: 24,
                                    padding: '32px 48px',
                                    fontSize: 22,
                                    fontWeight: 700,
                                    zIndex: 100,
                                    textAlign: 'center',
                                    boxShadow: 'var(--shadow-lg)',
                                }}>
                                    Подождите...<br />
                                    Сейчас начнётся конкурс!
                                </div>
                            )}
                            {/* Статус */}
                            {recording && (
                                <div style={statusStyle}>Конкурс начался</div>
                            )}
                            {/* Модалка результата */}
                            {showResultModal && (
                                <div style={resultModalStyle}>
                                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 18, color: 'var(--primary-color)' }}>
                                        Результаты сохранены!
                                    </div>
                                    <div style={{ fontSize: 20, color: 'var(--text-color)', marginBottom: 12 }}>
                                        Ваше видео отправлено на модерацию.<br />
                                        Ожидайте результаты в таблице рейтинга.<br />
                                        Спасибо за участие в конкурсе!
                                    </div>
                                    <div style={finishBtnRow}>
                                        <button style={okBtnStyle} onClick={onClose}>ОК</button>
                                        <button style={finishBtnAlt} onClick={handleResultRetry}>Начать заново</button>
                                    </div>
                                </div>
                            )}
                            {/* Финальный отсчёт 5-4-3-2-1 */}
                            {finalCountdown && (
                                <div style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    fontSize: 80,
                                    fontWeight: 900,
                                    color: 'var(--primary-color)',
                                    background: 'rgba(255,255,255,0.12)',
                                    borderRadius: 32,
                                    padding: '24px 48px',
                                    zIndex: 30,
                                    textShadow: '0 2px 16px rgba(0,0,0,0.18)',
                                    opacity: 0.97,
                                    transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
                                    pointerEvents: 'none',
                                    animation: 'fadeInScale 0.5s',
                                }}>
                                    {finalCountdown}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoRecorderModal; 