import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useHistoryAnimations = () => {
    const headerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Создаем главный таймлайн
        const mainTimeline = gsap.timeline({
            defaults: {
                ease: 'power3.out',
                duration: 0.6
            }
        });

        if (headerRef.current && timelineRef.current && filterRef.current) {
            // Анимация заголовка
            mainTimeline.fromTo(headerRef.current,
                {
                    y: -20,
                    opacity: 0
                },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.4
                }
            );

            // Анимация фильтра
            mainTimeline.fromTo(filterRef.current,
                {
                    y: -10,
                    opacity: 0
                },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.3
                },
                '-=0.2'
            );

            // Анимация для временной шкалы
            mainTimeline.fromTo(timelineRef.current,
                {
                    opacity: 0,
                    scale: 0.95
                },
                {
                    opacity: 1,
                    scale: 1,
                    duration: 0.5
                },
                '-=0.2'
            );

            // Создаем эффект параллакса для фона
            gsap.to(timelineRef.current, {
                backgroundPosition: '100% 100%',
                duration: 15,
                repeat: -1,
                ease: 'none',
                yoyo: true
            });

            // Добавляем ScrollTrigger для элементов истории
            ScrollTrigger.batch('.history-item', {
                start: 'top bottom-=100',
                end: 'bottom top+=100',
                onEnter: (elements) => {
                    gsap.to(elements, {
                        opacity: 1,
                        y: 0,
                        stagger: 0.15,
                        duration: 0.6,
                        ease: 'power3.out'
                    });
                },
                onLeave: (elements) => {
                    gsap.to(elements, {
                        opacity: 0.5,
                        y: -20,
                        stagger: 0.1,
                        duration: 0.3
                    });
                },
                onEnterBack: (elements) => {
                    gsap.to(elements, {
                        opacity: 1,
                        y: 0,
                        stagger: 0.1,
                        duration: 0.3
                    });
                },
                onLeaveBack: (elements) => {
                    gsap.to(elements, {
                        opacity: 0.5,
                        y: 20,
                        stagger: 0.1,
                        duration: 0.3
                    });
                }
            });
        }

        return () => {
            ScrollTrigger.getAll().forEach(trigger => trigger.kill());
            mainTimeline.kill();
        };
    }, []);

    // Функция для анимации нового элемента
    const animateNewHistoryItem = (element: HTMLElement) => {
        gsap.fromTo(element,
            {
                scale: 0.9,
                opacity: 0,
                y: 20
            },
            {
                scale: 1,
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: 'back.out(1.7)'
            }
        );
    };

    // Функция для анимации обновления элемента
    const animateHistoryItemUpdate = (element: HTMLElement) => {
        const tl = gsap.timeline();
        
        tl.to(element, {
            scale: 1.05,
            duration: 0.2,
            ease: 'power2.out'
        }).to(element, {
            scale: 1,
            duration: 0.3,
            ease: 'elastic.out(1, 0.5)'
        });

        // Добавляем эффект свечения
        gsap.fromTo(element,
            {
                boxShadow: '0 0 0 rgba(var(--primary-rgb), 0)'
            },
            {
                boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.3)',
                duration: 0.5,
                ease: 'power2.inOut',
                yoyo: true,
                repeat: 1
            }
        );
    };

    // Функция для анимации удаления элемента
    const animateHistoryItemRemoval = (element: HTMLElement) => {
        return gsap.to(element, {
            scale: 0.9,
            opacity: 0,
            x: -100,
            duration: 0.3,
            ease: 'power2.in'
        });
    };

    // Функция для анимации фильтрации
    const animateFilterChange = (elements: HTMLElement[]) => {
        gsap.to(elements, {
            opacity: 0,
            y: 20,
            stagger: 0.05,
            duration: 0.2,
            onComplete: () => {
                gsap.to(elements, {
                    opacity: 1,
                    y: 0,
                    stagger: 0.05,
                    duration: 0.3,
                    delay: 0.1
                });
            }
        });
    };

    return {
        headerRef,
        timelineRef,
        filterRef,
        animateNewHistoryItem,
        animateHistoryItemUpdate,
        animateHistoryItemRemoval,
        animateFilterChange
    };
}; 