'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SectionHeader from './SectionHeader';
import { useTheme } from './ThemeProvider';
import styles from './Features.module.css';

interface Slide {
  id: number;
  title: string;
  description: string;
  features: string[];
  mockupType: 'dual' | 'flow' | 'single' | 'responsive' | 'notification' | 'documents';
  images: string[];
}

const slides: Slide[] = [
  {
    id: 0,
    title: 'Инвентаризация',
    description: 'Считайте остатки с телефона. Несколько человек могут работать одновременно с одним списком.',
    features: [
      'Подсчет с телефона или планшета',
      'Одновременная работа нескольких человек',
      'История изменений — кто и что менял',
      'Готовый отчет Excel'
    ],
    mockupType: 'dual',
    images: ['/Moc Inventory.png', '/Moc Invantary_two.png']
  },
  {
    id: 1,
    title: 'Списание товаров',
    description: 'Зафиксируйте списание, приложите фото. Система сформирует акт списания Word.',
    features: [
      'Указываете товар, количество, причину',
      'Прикрепляете фото (опционально)',
      'Акт списания Word формируется автоматически',
      'История всех списаний'
    ],
    mockupType: 'flow',
    images: ['/982shots_so-Photoroom.png', '/870shots_so-Photoroom.png', '/190shots_so-Photoroom.png']
  },
  {
    id: 2,
    title: 'Контроль поставок',
    description: 'Ответственный принимает поставку и отмечает что пришло. Отдел закупок моментально получает уведомление.',
    features: [
      'Фиксация принятых товаров',
      'Отметка проблем (брак, недостача, пересорт)',
      'Автоматические уведомления отделу закупок',
      'История поставок по поставщикам'
    ],
    mockupType: 'single',
    images: ['/181shots_so-Photoroom.png']
  },
  {
    id: 3,
    title: 'Совместная работа',
    description: 'Все видят актуальные данные. Изменения отображаются мгновенно у всех участников.',
    features: [
      'Несколько человек работают одновременно',
      'Изменения синхронизируются мгновенно',
      'Видно кто сейчас онлайн',
      'Работает с телефона, планшета, компьютера'
    ],
    mockupType: 'responsive',
    images: ['/Laptop_so-Photoroom.png', '/Moc Inventory.png', '/table_so-Photoroom.png']
  },
  {
    id: 4,
    title: 'Уведомления в Telegram',
    description: 'Все события автоматически отправляются в нужные группы. Не нужно звонить или писать — информация приходит сама.',
    features: [
      'Завершена инвентаризация → уведомление группе',
      'Списание товара → уведомление ответственным',
      'Принята поставка → уведомление отделу закупок',
      'Настраиваемые группы по отделам'
    ],
    mockupType: 'notification',
    images: ['/636shots_so-Photoroom.png', '/170shots_so-Photoroom.png']
  },
  {
    id: 5,
    title: 'Готовые документы',
    description: 'Не нужно вручную заполнять Excel и Word. Система формирует документы автоматически.',
    features: [
      'Отчет инвентаризации Excel с остатками',
      'Акт списания Word с фото и подписями',
      'История документов',
      'Скачивание в один клик'
    ],
    mockupType: 'documents',
    images: ['/564shots_so-Photoroom.png', '/193shots_so-Photoroom.png']
  }
];

export default function Features() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [stage, setStage] = useState<'intro' | 'content'>('intro');
  const introTimeoutRef = useRef<number | null>(null);
  const resolvedTheme = isMounted ? theme : 'light';
  const isLight = resolvedTheme === 'light';
  const baseTextColor = isLight ? 'text-[#2B140B]' : 'text-white';
  const secondaryTextColor = isLight ? 'text-[#4B2B1E]/80' : 'text-gray-200/90';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isVisible || stage !== 'intro') return;
    if (introTimeoutRef.current) return;

    introTimeoutRef.current = window.setTimeout(() => {
      setStage('content');
      introTimeoutRef.current = null;
    }, 1400);

    return () => {
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
        introTimeoutRef.current = null;
      }
    };
  }, [isVisible, stage]);
  // Автоматическое пролистывание отключено

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [isMounted]);

  const nextSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const prevSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const goToSlide = (index: number) => {
    if (isAnimating || index === currentSlide) return;
    setIsAnimating(true);
    setCurrentSlide(index);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const renderMockup = (slide: Slide) => {
    const stageClass = `${styles.mockupStage} relative flex items-end justify-center w-full`;

    switch (slide.mockupType) {
      case 'dual':
        return (
          <div className={stageClass}>
            <div className="absolute inset-x-4 bottom-6 h-10 rounded-full bg-black/8 blur-2xl opacity-60"></div>

            <div
              className="relative origin-bottom -rotate-[5deg] mr-3"
              style={{ width: 'clamp(120px, 12.5vw, 170px)' }}
            >
              <div className="relative rounded-[26px] overflow-hidden">
                <Image
                  src={slide.images[0]}
                  alt={`${slide.title} — главный экран`}
                  width={210}
                  height={380}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>

            <div
              className="relative origin-bottom rotate-[6deg] translate-y-4 -ml-4"
              style={{ width: 'clamp(110px, 12vw, 160px)' }}
            >
              <div className="relative rounded-[24px] overflow-hidden">
                <Image
                  src={slide.images[1]}
                  alt={`${slide.title} — списки категорий`}
                  width={195}
                  height={350}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        );

      case 'flow':
        return (
          <div className={stageClass}>
            <div className="absolute inset-x-4 bottom-6 h-10 rounded-full bg-black/8 blur-2xl opacity-60"></div>

            <div className="relative z-20 origin-bottom -rotate-[2deg]" style={{ width: 'clamp(130px, 14vw, 200px)' }}>
              <div className="relative rounded-[28px] overflow-hidden">
                <Image
                  src={slide.images[0]}
                  alt={`${slide.title} — создание списания`}
                  width={240}
                  height={420}
                  className="w-full h-auto object-cover"
                  style={{ height: 'auto' }}
                  priority
                />
              </div>
            </div>

            <div className="relative -ml-8 z-10 translate-y-4 origin-bottom rotate-[4deg]" style={{ width: 'clamp(110px, 12vw, 170px)' }}>
              <div className="relative rounded-[26px] overflow-hidden">
                <Image
                  src={slide.images[1]}
                  alt={`${slide.title} — форма списания`}
                  width={210}
                  height={380}
                  className="w-full h-auto object-cover"
                  style={{ height: 'auto' }}
                  priority
                />
              </div>
            </div>

            <div className="relative -ml-10 z-0 translate-y-6 origin-bottom rotate-[6deg]" style={{ width: 'clamp(95px, 10.5vw, 150px)' }}>
              <div className="relative rounded-[24px] overflow-hidden">
                <Image
                  src={slide.images[2]}
                  alt={`${slide.title} — итоговый список`}
                  width={190}
                  height={340}
                  className="w-full h-auto object-cover"
                  style={{ height: 'auto' }}
                  priority
                />
              </div>
            </div>
          </div>
        );

      case 'single':
        return (
          <div className={stageClass}>
            <div className="absolute inset-x-4 bottom-6 h-10 rounded-full bg-black/8 blur-2xl opacity-60"></div>
            <div className="relative origin-bottom -rotate-[6deg]" style={{ width: 'clamp(115px, 12vw, 180px)' }}>
              <div className="relative rounded-[28px] overflow-hidden">
                <Image
                  src={slide.images[0]}
                  alt={slide.title}
                  width={220}
                  height={400}
                  className="w-full h-auto object-cover"
                  style={{ height: 'auto' }}
                  priority
                />
              </div>
            </div>
          </div>
        );

      case 'responsive':
        return (
          <div className={stageClass}>
            <div className="absolute inset-x-6 bottom-7 h-10 rounded-full bg-black/8 blur-2xl opacity-60"></div>

            <div className="relative z-20 origin-bottom -rotate-[2deg]" style={{ width: 'clamp(360px, 32vw, 480px)' }}>
              <div className="relative rounded-[40px] overflow-hidden">
                <Image
                  src={slide.images[0]}
                  alt="Flowix на ноутбуке"
                  width={780}
                  height={490}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>

            <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 origin-bottom rotate-[5deg]" style={{ width: 'clamp(50px, 6vw, 85px)' }}>
              <div className="relative rounded-[28px] overflow-hidden shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
                <Image
                  src={slide.images[1]}
                  alt="Flowix на телефоне"
                  width={50}
                  height={140}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>

            <div className="relative -ml-6 translate-y-9 origin-bottom rotate-[6deg]" style={{ width: 'clamp(150px, 17vw, 200px)' }}>
              <div className="relative overflow-hidden" style={{ transform: 'translate(-46px, -41px)' }}>
                <Image
                  src={slide.images[2]}
                  alt="Flowix на планшете"
                  width={220}
                  height={300}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={`${styles.mockupStage} flex items-center justify-center w-full max-w-[320px] rounded-[32px] border border-dashed border-white/30 text-white/60 dark:text-white/40 text-sm`}>
            Макет «{slide.title}»
          </div>
        );
    }
  };

  return (
    <section
      ref={sectionRef}
      id="features"
      className={`${styles.featuresSection} relative flex-shrink-0 w-screen snap-start overflow-hidden`}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          data-parallax-speed="70"
          className="absolute top-1/4 -right-48 w-[600px] h-[600px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-br from-[#FF9D66]/20 via-[#FF8040]/10 to-transparent rounded-full blur-3xl animate-float"></div>
        </div>
        <div
          data-parallax-speed="60"
          className="absolute bottom-1/4 -left-48 w-[500px] h-[500px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-tr from-[#FF8040]/20 via-[#FF9D66]/10 to-transparent rounded-full blur-3xl animate-float-delayed"></div>
        </div>
        <div
          data-parallax-speed="40"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-r from-[#FF9D66]/10 to-[#FF8040]/10 rounded-full blur-3xl animate-pulse-slow"></div>
        </div>
      </div>

      <div className={styles.inner}>
        <div className={`${styles.overlay} ${stage === 'intro' ? styles.overlayVisible : styles.overlayHidden}`}>
          <SectionHeader
            badge="Функционал системы"
            badgeIcon="✨"
            title="Возможности Flowix"
            highlightedWord="Flowix"
            description=""
            align="center"
            animated={true}
          />
        </div>

        <div className={`${styles.content} ${stage === 'content' && isVisible ? styles.contentActive : ''}`}>
          <div className={styles.mockupColumn}>
            <div className={`${styles.stageShell} rounded-[28px] border border-white/15 bg-white/5 dark:bg-white/10 backdrop-blur-sm`}>
              {renderMockup(slides[currentSlide])}
            </div>

            <div className={styles.controls}>
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className={`${styles.navButton} border border-white/25 text-[#FF7C45]`}
                aria-label="Предыдущий сценарий"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>

              <div className={styles.progressDots}>
                {slides.map((slide, index) => {
                  const isActive = index === currentSlide;
                  return (
                    <button
                      key={slide.id}
                      onClick={() => goToSlide(index)}
                      disabled={isAnimating}
                      className={`${styles.dot} ${isActive ? styles.dotActive : ''}`}
                      aria-label={`Открыть ${slide.title}`}
                    />
                  );
                })}
              </div>

              <button
                onClick={nextSlide}
                disabled={isAnimating}
                className={`${styles.navButton} border border-white/25 text-[#FF7C45]`}
                aria-label="Следующий сценарий"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18L15 12L9 6" />
                </svg>
              </button>
            </div>
          </div>

          <div className={`${styles.textColumn} ${baseTextColor}`}>
            <span className={`${styles.textBadge} border border-white/15 text-[#FF7C45]`}>
              {slides[currentSlide].title}
            </span>

            <p className={`${styles.textDescription} ${secondaryTextColor}`}>
              {slides[currentSlide].description}
            </p>

            <ul className={styles.featureList}>
              {slides[currentSlide].features.map((feature, idx) => (
                <li key={idx} className={`${styles.featureItem} ${secondaryTextColor}`}>
                  <span className={styles.featureIcon}>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}



