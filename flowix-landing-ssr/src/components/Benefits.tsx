'use client';

import { useEffect, useRef, useState } from 'react';
import SectionHeader from './SectionHeader';

interface Benefit {
  number: string;
  title: string;
  description: string;
  points: string[];
}

const benefits: Benefit[] = [
  {
    number: '01',
    title: 'Простота использования',
    description: 'Работает на обычных смартфонах и планшетах. Не нужно покупать специальное оборудование или учить сотрудников сложному софту.',
    points: [
      'Используйте телефоны, которые уже есть',
      'Интуитивный веб-интерфейс',
      'Работает с любого устройства'
    ]
  },
  {
    number: '02',
    title: 'Управление и коммуникация в Telegram',
    description: 'Не нужно переключаться между приложениями. Вход через Telegram ID, уведомления и общение в одном месте - там, где ваша команда уже работает.',
    points: [
      'Мгновенный вход без регистрации',
      'Уведомления приходят в Telegram',
      'Коммуникация и учет в одной среде'
    ]
  },
  {
    number: '03',
    title: 'Контроль и прозрачность',
    description: 'Видно кто, когда и что делал. Каждое изменение фиксируется с указанием сотрудника и времени.',
    points: [
      'История всех действий с временем и автором',
      'Невозможно незаметно изменить данные',
      'Ответственность каждого сотрудника'
    ]
  },
  {
    number: '04',
    title: 'Автоматизация рутины',
    description: 'Документы формируются автоматически. Уведомления отправляются сами. Не нужно вручную заполнять Excel или писать отчеты.',
    points: [
      'Автоматическая генерация отчетов',
      'Уведомления без вашего участия',
      'Меньше ручной работы с документами'
    ]
  }
];

export default function Benefits() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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

  return (
    <section
      ref={sectionRef}
      id="benefits"
      className="relative h-screen w-screen flex-shrink-0 flex items-start md:items-center snap-start overflow-x-hidden overflow-y-auto"
      style={{ paddingTop: '110px', paddingBottom: '52px' }}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-gradient-to-br from-[#FF9D66]/15 via-[#FF8040]/10 to-transparent rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 -right-40 w-[600px] h-[600px] bg-gradient-to-tl from-[#FF8040]/15 via-[#FF9D66]/10 to-transparent rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      <div className="container relative z-10 h-full flex flex-col justify-start md:justify-center gap-10 px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="mb-8 md:mb-10">
          <SectionHeader
            badge="Главные преимущества"
            badgeIcon="⭐"
            title="Почему Flowix?"
            highlightedWord="Flowix"
            align="center"
            animated={true}
          />
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] mx-auto">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.number}
              className={`group relative transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Glassmorphism Card */}
              <div 
                className="relative h-full rounded-[28px] bg-white/40 dark:bg-black/20 backdrop-blur-xl border-2 border-white/30 dark:border-white/10 shadow-xl hover:shadow-2xl hover:border-[#FF9D66]/30 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 overflow-hidden"
                style={{ paddingLeft: '32px', paddingRight: '32px', paddingTop: '32px', paddingBottom: '32px' }}
              >
                
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF9D66]/0 via-[#FF9D66]/5 to-[#FF8040]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px] pointer-events-none"></div>

                {/* Big Number Background - RIGHT TOP */}
                <div className="absolute top-4 right-4 text-[64px] leading-none font-black text-[#FF5F1F]/[0.08] dark:text-[#FF5F1F]/[0.15] select-none pointer-events-none">
                  {benefit.number}
                </div>

                {/* Title */}
                <h3 className="relative text-[22px] font-extrabold mb-3 text-gray-900 dark:text-white leading-tight z-10">
                  {benefit.title}
                </h3>

                {/* Description */}
                <p className="relative text-[14px] text-gray-700 dark:text-gray-300 leading-relaxed mb-5 z-10">
                  {benefit.description}
                </p>

                {/* Points List */}
                <ul className="relative space-y-2.5 z-10">
                  {benefit.points.map((point, idx) => (
                    <li key={idx} className="flex items-start pl-7 relative">
                      {/* Check Icon */}
                      <div className="absolute left-0 top-0.5">
                        <div className="relative w-4 h-4">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#FF9D66] to-[#FF8040] rounded-md opacity-20 group-hover:opacity-100 transition-opacity blur-sm"></div>
                          <div className="relative w-full h-full rounded-md bg-gradient-to-br from-[#FF9D66] to-[#FF8040] flex items-center justify-center shadow-sm">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {/* Point Text */}
                      <span className="flex-1 text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>

              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

