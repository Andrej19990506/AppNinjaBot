import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export const useDialogAnimations = () => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (dialogRef.current && titleRef.current && contentRef.current && actionsRef.current) {
            // Создаем главный таймлайн
            const tl = gsap.timeline({
                defaults: {
                    ease: 'power3.out',
                    duration: 0.4
                }
            });

            // Анимация появления диалога
            tl.fromTo(dialogRef.current,
                {
                    scale: 0.9,
                    opacity: 0,
                    y: 20
                },
                {
                    scale: 1,
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'back.out(1.7)'
                }
            );

            // Анимация заголовка
            tl.fromTo(titleRef.current,
                {
                    opacity: 0,
                    y: -20
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.3
                },
                "-=0.2"
            );

            // Анимация контента
            tl.fromTo(contentRef.current,
                {
                    opacity: 0,
                    y: 20
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.3
                },
                "-=0.2"
            );

            // Анимация кнопок
            tl.fromTo(actionsRef.current,
                {
                    opacity: 0,
                    y: 20
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.3
                },
                "-=0.2"
            );

            // Добавляем эффект свечения при наведении
            const handleMouseMove = (e: MouseEvent) => {
                if (!dialogRef.current) return;
                
                const rect = dialogRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                dialogRef.current.style.setProperty('--mouse-x', `${x}px`);
                dialogRef.current.style.setProperty('--mouse-y', `${y}px`);
            };

            dialogRef.current.addEventListener('mousemove', handleMouseMove);

            return () => {
                if (dialogRef.current) {
                    dialogRef.current.removeEventListener('mousemove', handleMouseMove);
                }
                tl.kill();
            };
        }
    }, []);

    // Функция для анимации закрытия
    const animateClose = () => {
        if (!dialogRef.current) return Promise.resolve();

        const tl = gsap.timeline({
            defaults: {
                ease: 'power3.in',
                duration: 0.3
            }
        });

        return new Promise<void>((resolve) => {
            tl.to(actionsRef.current, {
                opacity: 0,
                y: 20,
                duration: 0.2
            })
            .to(contentRef.current, {
                opacity: 0,
                y: 20,
                duration: 0.2
            }, "-=0.1")
            .to(titleRef.current, {
                opacity: 0,
                y: -20,
                duration: 0.2
            }, "-=0.1")
            .to(dialogRef.current, {
                scale: 0.9,
                opacity: 0,
                y: 20,
                duration: 0.3,
                onComplete: resolve
            }, "-=0.1");
        });
    };

    return {
        dialogRef,
        titleRef,
        contentRef,
        actionsRef,
        animateClose
    };
}; 