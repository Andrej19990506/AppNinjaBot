'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SectionHeader from './SectionHeader';
import { useTheme } from './ThemeProvider';

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
    images: ['/Laptop_so-Photoroom.png', '/Phone820shots_so.png', '/table_so-Photoroom.png']
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
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const baseTextColor = isLight ? 'text-[#2B140B]' : 'text-white';
  const secondaryTextColor = isLight ? 'text-[#4B2B1E]/80' : 'text-gray-200';
  const bulletTextColor = isLight ? 'text-[#3C2415]' : 'text-gray-200';
  const cardBackground = isLight ? 'bg-white/90 border-[#FF9D66]/22 shadow-[0_20px_60px_rgba(255,140,70,0.18)]' : 'bg-white/40 dark:bg-black/20 border border-white/30 dark:border-white/10 shadow-2xl';

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

  // Intersection Observer for scroll animations
  useEffect(() => {
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
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAnimating) {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [isAnimating]);

  // Update carousel transform
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
  }, [currentSlide]);

  const renderMockup = (slide: Slide) => {
    switch (slide.mockupType) {
      case 'dual':
        return (
          <div className="flex items-center justify-center gap-3 scale-[0.85]">
            {/* Left mockup */}
            <div className="relative animate-float-device-left">
              <Image
                src={slide.images[0]}
                alt={`${slide.title} - процесс`}
                width={190}
                height={405}
                className="w-auto h-auto max-w-[190px] [transform:rotateY(10deg)_rotateX(2deg)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.3)] hover:[transform:rotateY(6deg)_rotateX(1deg)_scale(1.03)] transition-transform duration-500"
                priority
              />
            </div>
            {/* Right mockup with confetti */}
            <div className="relative animate-float-device-right">
              <Image
                src={slide.images[1]}
                alt={`${slide.title} - результат`}
                width={175}
                height={380}
                className="w-auto h-auto max-w-[175px] [transform:rotateY(-8deg)_rotateX(2deg)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.3)] hover:[transform:rotateY(-4deg)_rotateX(1deg)_scale(1.03)] transition-transform duration-500"
                priority
              />
              {/* Confetti */}
              <span className="absolute -top-3 -right-1 text-xl animate-float pointer-events-none">🎉</span>
              <span className="absolute top-1 right-3 text-lg animate-float-delayed pointer-events-none">✨</span>
              <span className="absolute -bottom-1 right-1 text-lg animate-float pointer-events-none">⭐</span>
            </div>
          </div>
        );

      case 'flow':
        return (
          <div className="relative flex items-center justify-center w-full scale-[0.7]">
            {/* Step 1 */}
            <div className="relative z-[1] -mr-16">
              <Image
                src={slide.images[0]}
                alt={`${slide.title} - шаг 1`}
                width={180}
                height={385}
                className="w-auto h-auto max-w-[180px] [transform:rotateY(-7deg)_scale(0.95)] drop-shadow-[0_15px_30px_rgba(255,157,102,0.2)] [filter:brightness(0.95)]"
                priority
              />
            </div>
            {/* Step 2 */}
            <div className="relative z-[2] -mr-14">
              <Image
                src={slide.images[1]}
                alt={`${slide.title} - шаг 2`}
                width={160}
                height={345}
                className="w-auto h-auto max-w-[160px] rounded-[14px] [transform:rotateY(-4deg)_scale(0.88)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.3)]"
                priority
              />
            </div>
            {/* Step 3 */}
            <div className="relative z-[3]">
              <Image
                src={slide.images[2]}
                alt={`${slide.title} - шаг 3`}
                width={140}
                height={300}
                className="w-auto h-auto max-w-[140px] rounded-[14px] [transform:rotateY(-2deg)_scale(0.8)] drop-shadow-[0_25px_50px_rgba(255,157,102,0.4)]"
                priority
              />
            </div>
          </div>
        );

      case 'single':
        return (
          <div className="flex items-center justify-center scale-[0.85]">
            <div className="relative animate-float-device">
              <Image
                src={slide.images[0]}
                alt={slide.title}
                width={210}
                height={450}
                className="w-auto h-auto max-w-[210px] [transform:rotateY(8deg)_rotateX(2deg)] drop-shadow-[0_25px_50px_rgba(255,157,102,0.3)] hover:[transform:rotateY(4deg)_rotateX(1deg)_scale(1.03)] transition-transform duration-500"
                priority
              />
            </div>
          </div>
        );

      case 'responsive':
        return (
          <div className="flex items-end justify-center gap-2 scale-[0.75]">
            {/* Laptop */}
            <div className="relative z-[1] -mr-6 transition-all duration-400 hover:z-10">
              <Image
                src={slide.images[0]}
                alt="FloWix на ноутбуке"
                width={260}
                height={165}
                className="w-auto h-auto max-w-[260px] [transform:rotateY(10deg)_rotateX(2deg)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.25)] hover:[transform:rotateY(0deg)_scale(1.03)] transition-all duration-400"
                priority
              />
            </div>
            {/* Phone */}
            <div className="relative z-[3] mx-1 transition-all duration-400 hover:z-10">
              <Image
                src={slide.images[1]}
                alt="FloWix на телефоне"
                width={75}
                height={160}
                className="w-auto h-auto max-w-[75px] drop-shadow-[0_25px_50px_rgba(255,157,102,0.35)] hover:scale-105 transition-all duration-400"
                priority
              />
            </div>
            {/* Tablet */}
            <div className="relative z-[2] -ml-6 transition-all duration-400 hover:z-10">
              <Image
                src={slide.images[2]}
                alt="FloWix на планшете"
                width={175}
                height={235}
                className="w-auto h-auto max-w-[175px] [transform:rotateY(-10deg)_rotateX(2deg)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.25)] hover:[transform:rotateY(0deg)_scale(1.03)] transition-all duration-400"
                priority
              />
            </div>
          </div>
        );

      case 'notification':
        return (
          <div className="flex items-center justify-center gap-1 scale-[0.75]">
            {/* First notification */}
            <div className="relative z-[1] -mr-10">
              <Image
                src={slide.images[0]}
                alt="Уведомление 1"
                width={230}
                height={172}
                className="w-auto h-auto max-w-[230px] rounded-[18px] [transform:rotateY(-5deg)_rotateX(1deg)] drop-shadow-[0_20px_40px_rgba(255,157,102,0.25)] hover:[transform:rotateY(0deg)_scale(1.03)] transition-all duration-500"
                priority
              />
            </div>
            {/* Second notification */}
            <div className="relative z-[2] mt-6">
              <Image
                src={slide.images[1]}
                alt="Уведомление 2"
                width={245}
                height={184}
                className="w-auto h-auto max-w-[245px] rounded-[18px] [transform:rotateY(5deg)_rotateX(-1deg)] drop-shadow-[0_25px_50px_rgba(255,157,102,0.35)] hover:[transform:rotateY(0deg)_scale(1.03)] transition-all duration-500"
                priority
              />
            </div>
          </div>
        );

      case 'documents':
        return (
          <div className="flex items-center justify-center gap-3 scale-[0.85]">
            {/* Excel Document */}
            <div className="group relative bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl rounded-xl p-2.5 border border-[#FF9D66]/10 shadow-lg hover:shadow-2xl hover:border-[#FF9D66]/30 hover:scale-105 transition-all duration-500 cursor-pointer">
              {/* Excel Icon */}
              <div className="absolute -top-2 -right-2 z-10">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="drop-shadow-lg">
                  <rect width="48" height="48" rx="8" fill="#217346"/>
                  <path d="M32 10H16C14.9 10 14 10.9 14 12V36C14 37.1 14.9 38 16 38H32C33.1 38 34 37.1 34 36V12C34 10.9 33.1 10 32 10Z" fill="#107C41"/>
                  <path d="M19 20L21.5 24L19 28H21.5L23 26L24.5 28H27L24.5 24L27 20H24.5L23 22L21.5 20H19Z" fill="white"/>
                </svg>
              </div>
              <Image
                src={slide.images[0]}
                alt="Excel отчет"
                width={170}
                height={113}
                className="w-auto h-auto max-w-[170px] rounded-lg shadow-md"
                priority
              />
            </div>
            {/* Word Document */}
            <div className="group relative bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl rounded-xl p-2.5 border border-[#FF9D66]/10 shadow-lg hover:shadow-2xl hover:border-[#FF9D66]/30 hover:scale-105 transition-all duration-500 cursor-pointer mt-5">
              {/* Word Icon */}
              <div className="absolute -top-2 -right-2 z-10">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="drop-shadow-lg">
                  <rect width="48" height="48" rx="8" fill="#2B579A"/>
                  <path d="M32 10H16C14.9 10 14 10.9 14 12V36C14 37.1 14.9 38 16 38H32C33.1 38 34 37.1 34 36V12C34 10.9 33.1 10 32 10Z" fill="#185ABD"/>
                  <path d="M18 20H20.5L22 26L23.5 20H26L27.5 26L29 20H31.5L28.5 30H26L24 24L22 30H19.5L16.5 20H18Z" fill="white"/>
                </svg>
              </div>
              <Image
                src={slide.images[1]}
                alt="Word акт"
                width={170}
                height={113}
                className="w-auto h-auto max-w-[170px] rounded-lg shadow-md"
                priority
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative h-screen w-screen flex-shrink-0 flex items-center snap-start overflow-x-hidden overflow-y-auto"
      style={{ paddingTop: '100px', paddingBottom: '30px' }}
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

      <div className="container relative z-10 h-full flex flex-col justify-center">
        {/* Section Header */}
        <div className="mb-8">
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

      {/* Carousel Container */}
      <div className={`relative z-10 w-full flex justify-center transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`} style={{ transitionDelay: '400ms' }}>
        {/* Container с ограничением ширины */}
        <div className="w-full max-w-[1260px] px-4 sm:px-6 lg:px-8">
          
          {/* Glassmorphism Card */}
          <div className={`w-full rounded-2xl lg:rounded-3xl backdrop-blur-2xl overflow-hidden ${cardBackground}`}>
            
            {/* Flex контейнер для карусели */}
            <div 
              ref={trackRef}
              className="flex transition-transform duration-800 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              {slides.map((slide) => (
                <div 
                  key={slide.id}
                  className="w-full min-w-full flex-shrink-0"
                >
                  {/* Wrapper для центрирования grid */}
                  <div className="w-full flex items-center justify-center" style={{ paddingLeft: '32px', paddingRight: '32px', paddingTop: '24px', paddingBottom: '24px' }}>
                    {/* Grid контейнер */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center w-full max-w-[1080px] mx-auto min-h-[380px]">
                      
                      {/* LEFT: Mockup */}
                      <div className="flex items-center justify-center order-2 lg:order-1 w-full">
                        <div className="relative w-full max-w-[500px] mx-auto h-full flex items-center justify-center">
                          {renderMockup(slide)}
                        </div>
                      </div>

                      {/* RIGHT: Content */}
                      <div className={`flex flex-col justify-center order-1 lg:order-2 w-full space-y-3 ${baseTextColor}`}>
                        
                        {/* Title */}
                        <h3 className={`text-2xl sm:text-3xl lg:text-[28px] font-black leading-tight ${isLight ? 'text-[#2B140B]' : 'bg-gradient-to-r from-gray-200 to-white bg-clip-text text-transparent'}`}>
                          {slide.title}
                        </h3>
                        
                        {/* Description */}
                        <p className={`text-sm sm:text-base lg:text-[14px] leading-relaxed font-medium ${secondaryTextColor}`}>
                          {slide.description}
                        </p>

                        {/* Features List */}
                        <ul className="flex flex-col gap-1.5 pt-1">
                          {slide.features.map((feature, idx) => (
                            <li key={idx} className="group flex items-start gap-2 p-1.5 rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-all duration-300">
                              
                              {/* Icon */}
                              <div className="relative flex-shrink-0 w-4 h-4 mt-0.5">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#FF9D66] to-[#FF8040] rounded-lg opacity-20 group-hover:opacity-100 transition-opacity blur-sm"></div>
                                <div className="relative w-full h-full rounded-lg bg-gradient-to-br from-[#FF9D66] to-[#FF8040] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Text */}
                              <span className={`flex-1 text-xs sm:text-sm lg:text-[13px] leading-relaxed font-medium ${bulletTextColor}`}>
                                {feature}
                              </span>
                              
                            </li>
                          ))}
                        </ul>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation inside card */}
            <div className={`flex items-center justify-center gap-4 transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`} style={{ transitionDelay: '600ms', paddingTop: '16px', paddingBottom: '16px' }}>
              
              {/* Prev Button */}
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className="group w-12 h-12 rounded-xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/20 hover:border-[#FF9D66]/50 flex items-center justify-center hover:scale-110 hover:-translate-x-1 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[#FF9D66]/30"
                aria-label="Предыдущий слайд"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300 group-hover:text-[#FF9D66] transition-colors">
                  <path d="M15 18L9 12L15 6"/>
                </svg>
              </button>

              {/* Indicators Container */}
              <div className="flex gap-2 items-center px-5 py-2.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-lg">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    disabled={isAnimating}
                    className={`relative h-2.5 rounded-full transition-all duration-500 disabled:cursor-not-allowed ${
                      index === currentSlide
                        ? 'w-20 bg-gradient-to-r from-[#FF9D66] via-[#FF8040] to-[#FF9D66] shadow-lg shadow-[#FF9D66]/50'
                        : 'w-2.5 bg-gray-400/60 dark:bg-gray-500/60 hover:w-10 hover:bg-[#FF9D66]/70'
                    }`}
                    aria-label={`Слайд ${index + 1}`}
                  >
                    {index === currentSlide && (
                      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF9D66] to-[#FF8040] animate-pulse"></span>
                    )}
                  </button>
                ))}
              </div>

              {/* Next Button */}
              <button
                onClick={nextSlide}
                disabled={isAnimating}
                className="group w-12 h-12 rounded-xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/20 hover:border-[#FF9D66]/50 flex items-center justify-center hover:scale-110 hover:translate-x-1 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[#FF9D66]/30"
                aria-label="Следующий слайд"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300 group-hover:text-[#FF9D66] transition-colors">
                  <path d="M9 18L15 12L9 6"/>
                </svg>
              </button>

            </div>

          </div>
        </div>
      </div>
      </div>
    </section>
  );
}



