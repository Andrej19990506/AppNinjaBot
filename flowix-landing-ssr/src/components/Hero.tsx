'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useTheme } from './ThemeProvider';
import MobileMenu from './MobileMenu';

export default function Hero() {
  const { theme, toggleTheme } = useTheme();
  const phoneLightRef = useRef<HTMLImageElement>(null);
  const phoneDarkRef = useRef<HTMLImageElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const heroImagesRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLAnchorElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [initialTheme, setInitialTheme] = useState<string | null>(null);

  // Инициализация
  useEffect(() => {
    // Отключаем AOS, будем использовать только GSAP для лучшего контроля
    // Читаем тему сразу из DOM для синхронизации
    const savedTheme = typeof window !== 'undefined' 
      ? (localStorage.getItem('theme') || 'dark')
      : 'dark';
    setInitialTheme(savedTheme);
  }, []);

  // Мастер-анимация при загрузке
  useEffect(() => {
    // Выполняется только при первой загрузке
    if (mounted || !initialTheme) return;
    
    const phoneLight = phoneLightRef.current;
    const phoneDark = phoneDarkRef.current;
    const heroText = heroTextRef.current;
    const heroImages = heroImagesRef.current;
    
    if (!phoneLight || !phoneDark || !heroText || !heroImages) return;

    const currentTheme = initialTheme;

    // Начальная установка позиций
    if (currentTheme === 'dark') {
      gsap.set(phoneLight, {
        left: '50%',
        top: '50%',
        x: '-50%',
        y: '-50%',
        scale: 0.9,
        rotation: 0,
        opacity: 0,
        zIndex: 1
      });
      
      gsap.set(phoneDark, {
        left: '50%',
        top: '50%',
        x: '-50%',
        y: '-50%',
        scale: 1,
        rotation: 0,
        opacity: 1,
        zIndex: 2
      });
    } else {
      gsap.set(phoneLight, {
        left: '50%',
        top: '50%',
        x: '-50%',
        y: '-50%',
        scale: 1,
        rotation: 0,
        opacity: 1,
        zIndex: 2
      });
      
      gsap.set(phoneDark, {
        left: '50%',
        top: '50%',
        x: '-50%',
        y: '-50%',
        scale: 0.9,
        rotation: 0,
        opacity: 0,
        zIndex: 1
      });
    }

    // Скрываем элементы перед анимацией
    const h1 = heroText.querySelector('h1');
    const p = heroText.querySelector('p');
    const buttons = heroText.querySelector('.hero-buttons');
    
    gsap.set([h1, p, buttons, heroImages], { opacity: 0 });
    gsap.set(h1, { x: -60, y: 20 });
    gsap.set(p, { x: -40, y: 20 });
    gsap.set(buttons, { x: -30, y: 20 });
    gsap.set(heroImages, { x: 60, scale: 0.95 });

    // Создаем мастер Timeline для идеальной синхронизации
    const masterTimeline = gsap.timeline({
      delay: 0.3,
      onComplete: () => setMounted(true)
    });

    // Фаза 1: Заголовок появляется (0s - 0.8s)
    masterTimeline.to(h1, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, 0);

    // Фаза 2: Параллельно с заголовком начинается движение контейнера телефонов
    masterTimeline.to(heroImages, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.9,
      ease: 'power3.out'
    }, 0.1);

    // Фаза 3: Активный телефон разворачивается (0.2s - 1.1s)
    if (currentTheme === 'dark') {
      masterTimeline.to(phoneDark, {
        left: '60%',
        rotation: 10,
        duration: 0.9,
        ease: 'power2.out'
      }, 0.2);
    } else {
      masterTimeline.to(phoneLight, {
        left: '40%',
        rotation: -10,
        duration: 0.9,
        ease: 'power2.out'
      }, 0.2);
    }

    // Фаза 4: Подзаголовок появляется (0.3s - 1.1s)
    masterTimeline.to(p, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, 0.3);

    // Фаза 5: Неактивный телефон появляется (0.5s - 1.3s)
    if (currentTheme === 'dark') {
      masterTimeline.to(phoneLight, {
        left: '35%',
        rotation: -15,
        opacity: 0.95,
        duration: 0.8,
        ease: 'power2.out'
      }, 0.5);
    } else {
      masterTimeline.to(phoneDark, {
        left: '65%',
        rotation: 15,
        opacity: 0.95,
        duration: 0.8,
        ease: 'power2.out'
      }, 0.5);
    }

    // Фаза 6: Кнопки появляются последними (0.5s - 1.2s)
    masterTimeline.to(buttons, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.7,
      ease: 'power2.out'
    }, 0.5);

    return () => {
      masterTimeline.kill();
    };
  }, [initialTheme, mounted]);

  // Магнитный эффект для кнопки - точно как в оригинале
  useEffect(() => {
    const button = primaryBtnRef.current;
    if (!button) return;
    
    const handleMouseEnter = () => {
      // Отключаем transition для мгновенной реакции
      button.style.transition = 'none';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const moveX = x * 0.3;
      const moveY = y * 0.3;
      
      // Прямое изменение transform без transition - МГНОВЕННО!
      button.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
    };
    
    const handleMouseLeave = () => {
      // Включаем transition обратно для плавного возврата
      button.style.transition = '';
      button.style.transform = 'translate(0, 0) scale(1)';
    };
    
    button.addEventListener('mouseenter', handleMouseEnter);
    button.addEventListener('mousemove', handleMouseMove);
    button.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      button.removeEventListener('mouseenter', handleMouseEnter);
      button.removeEventListener('mousemove', handleMouseMove);
      button.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Анимация при смене темы
  useEffect(() => {
    if (!mounted) return;
    
    const phoneLight = phoneLightRef.current;
    const phoneDark = phoneDarkRef.current;
    
    if (!phoneLight || !phoneDark || !isAnimating) return;

    const duration = 0.6;
    const ease = 'power2.out';
    
    if (theme === 'dark') {
      gsap.to(phoneLight, {
        left: '35%',
        x: '-50%',
        y: '-50%',
        scale: 0.9,
        rotation: -15,
        opacity: 0.95,
        zIndex: 1,
        duration,
        ease
      });
      
      gsap.to(phoneDark, {
        left: '60%',
        x: '-50%',
        y: '-50%',
        scale: 1,
        rotation: 10,
        opacity: 1,
        zIndex: 2,
        duration,
        ease
      });
    } else {
      gsap.to(phoneLight, {
        left: '40%',
        x: '-50%',
        y: '-50%',
        scale: 1,
        rotation: -10,
        opacity: 1,
        zIndex: 2,
        duration,
        ease
      });
      
      gsap.to(phoneDark, {
        left: '65%',
        x: '-50%',
        y: '-50%',
        scale: 0.9,
        rotation: 15,
        opacity: 0.95,
        zIndex: 1,
        duration,
        ease
      });
    }
  }, [theme, isAnimating, mounted]);

  const handlePhoneLightClick = () => {
    if (theme === 'light' || isAnimating) return;
    
    setIsAnimating(true);
    toggleTheme('light');
    
    // Анимация клика
    if (phoneLightRef.current) {
      gsap.to(phoneLightRef.current, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
        onComplete: () => {
          setTimeout(() => setIsAnimating(false), 800);
        }
      });
    }
  };

  const handlePhoneDarkClick = () => {
    if (theme === 'dark' || isAnimating) return;
    
    setIsAnimating(true);
    toggleTheme('dark');
    
    // Анимация клика
    if (phoneDarkRef.current) {
      gsap.to(phoneDarkRef.current, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
        onComplete: () => {
          setTimeout(() => setIsAnimating(false), 800);
        }
      });
    }
  };

  return (
    <section
      id="hero"
      className="relative h-screen w-screen flex-shrink-0 flex items-center pt-32 pb-20 snap-start overflow-x-hidden overflow-y-auto"
    >
      {/* Простые декоративные элементы */}
      <div
        data-parallax-speed="80"
        className="absolute top-20 -right-40 w-96 h-96 bg-gradient-radial from-orange-200/20 to-transparent rounded-full blur-3xl opacity-70"
        style={{ transform: 'translate3d(0, 0, 0)' }}
      ></div>
      <div
        data-parallax-speed="60"
        className="absolute bottom-20 -left-40 w-96 h-96 bg-gradient-radial from-orange-300/20 to-transparent rounded-full blur-3xl opacity-70"
        style={{ transform: 'translate3d(0, 0, 0)' }}
      ></div>

      {/* Топ бар - Логотип + Бургер выровнены */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-8 py-6 pointer-events-none" style={{ zIndex: 300 }}>
        <div className="pointer-events-auto">
          <Image
            src="/Logo.png"
            alt="FloWix Logo"
            width={140}
            height={140}
            className="h-20 sm:h-24 md:h-28 w-auto drop-shadow-[0_8px_24px_rgba(255,107,53,0.4)] drop-shadow-[0_4px_12px_rgba(255,157,102,0.3)] drop-shadow-[0_0_40px_rgba(255,107,53,0.2)] transition-all duration-400 animate-logo-glow hover:scale-[1.08] hover:-translate-y-0.5 relative z-[300]"
          />
        </div>
        
        {/* Mobile Menu */}
        <div className="pointer-events-auto">
          <MobileMenu />
        </div>
      </div>

      <div className="container relative z-10">
        <div className="hero-content">
          {/* Hero Text */}
          <div 
            ref={heroTextRef}
            className="hero-text"
          >
            <h1>
              Автоматизация<br />
              внутренних процессов<br />
              вашего <span className="gradient-text">бизнеса</span>
            </h1>

            <p className="hero-subtitle">
              Инвентаризация, списания, поставки, автоматические отчеты - всё в одной системе. 
              Для магазинов, складов, ресторанов, любых точек продаж. Интеграция с Telegram для мгновенных уведомлений.
            </p>

            <div className="hero-buttons">
              <Link
                ref={primaryBtnRef}
                href="#contact"
                className="group relative inline-flex items-center justify-center rounded-[48px] text-2xl font-bold text-gray-900 dark:text-white bg-white/50 dark:bg-black/30 backdrop-blur-xl border-2 border-white/40 dark:border-white/20 hover:border-[#FF9D66]/50 shadow-[0_4px_16px_rgba(255,95,31,0.3)] hover:shadow-[0_8px_32px_rgba(255,95,31,0.5)] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
                style={{ paddingLeft: '64px', paddingRight: '64px', paddingTop: '22px', paddingBottom: '22px', gap: '19px' }}
              >
                {/* Gradient overlay on hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-[#FF9D66]/10 via-[#FF9D66]/20 to-[#FF8040]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[48px]"></span>
                
                {/* Content */}
                <span className="relative z-10">Связаться</span>
                <svg className="relative z-10 group-hover:translate-x-1 transition-transform duration-300" width="29" height="29" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Hero Images */}
          <div 
            ref={heroImagesRef}
            className="relative min-h-[450px] sm:min-h-[550px] lg:min-h-[650px] flex items-center justify-center perspective-[2000px]" 
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glow effect - улучшенный */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[550px] lg:w-[650px] h-[450px] sm:h-[550px] lg:h-[650px] rounded-full animate-glow"
              style={{
                background: 'radial-gradient(circle, rgba(255, 95, 31, 0.4) 0%, rgba(255, 139, 89, 0.3) 30%, rgba(255, 157, 102, 0.2) 50%, transparent 70%)',
                filter: 'blur(50px)'
              }}
            />

            {/* Phone mockups */}
            <Image
              ref={phoneLightRef}
              src="/Phone820shots_so.png"
              alt="FloWix Light Theme"
              width={280}
              height={560}
              className="absolute w-[200px] sm:w-[240px] lg:w-[280px] cursor-pointer pointer-events-auto z-10 hover:brightness-110 hover:drop-shadow-[0_20px_40px_rgba(255,95,31,0.3)]"
              style={{ 
                height: 'auto',
                opacity: initialTheme ? undefined : 0,
                visibility: initialTheme ? 'visible' : 'hidden'
              }}
              onClick={handlePhoneLightClick}
              priority
            />
            
            <Image
              ref={phoneDarkRef}
              src="/166shots_so.png"
              alt="FloWix Dark Theme"
              width={280}
              height={560}
              className="absolute w-[200px] sm:w-[240px] lg:w-[280px] cursor-pointer pointer-events-auto z-10 hover:brightness-110 hover:drop-shadow-[0_20px_40px_rgba(255,95,31,0.3)]"
              style={{ 
                height: 'auto',
                opacity: initialTheme ? undefined : 0,
                visibility: initialTheme ? 'visible' : 'hidden'
              }}
              onClick={handlePhoneDarkClick}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
