'use client';

import { useState, useEffect, useRef } from 'react';
import SectionHeader from './SectionHeader';

const faqCategories = [
  {
    id: 'security',
    label: 'Безопасность',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    description: 'Как мы защищаем ваши данные',
    items: [
      {
        question: 'Как вы храните данные моей компании?',
        answer: (
          <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p><strong>Мы храним только публичную информацию, которая нужна для работы системы:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Название Telegram-группы</li>
              <li>Имена сотрудников и их Telegram ID для уведомлений</li>
              <li>История действий (кто и когда что изменил)</li>
            </ul>
            <p>Все данные находятся на защищенных серверах и шифруются как при передаче, так и при хранении.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Мы не сохраняем цены, себестоимость, договоры и другую коммерческую тайну.</p>
          </div>
        )
      },
      {
        question: 'Что происходит с данными инвентаризации?',
        answer: (
          <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <ol className="list-decimal pl-5 space-y-1">
              <li><strong>Начало:</strong> загружаем только названия товаров на время подсчета.</li>
              <li><strong>Проведение:</strong> данные шифруются и доступны только вашей команде.</li>
              <li><strong>Завершение:</strong> формируем Excel-отчет и удаляем черновики.</li>
            </ol>
            <p>Навсегда сохраняется лишь история действий и ваши заметки.</p>
          </div>
        )
      },
      {
        question: 'Какие данные сотрудников вы храните?',
        answer: (
          <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>Только публичные данные из Telegram:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Имя пользователя</li>
              <li>Telegram ID для уведомлений</li>
              <li>Роли и права внутри системы</li>
            </ul>
            <p>Пароли, личные контакты и другая чувствительная информация не собираются.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'technical',
    label: 'Технические',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m10.6 10.6 2.12 2.12M2 12h3m14 0h3m-3.05-7.05-2.12 2.12m-10.6 10.6-2.12 2.12" />
      </svg>
    ),
    description: 'Доступ, интеграции и инфраструктура',
    items: [
      {
        question: 'Нужно ли ставить приложение?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>Нет. FloWix работает в браузере и в Telegram. Доступен на телефонах, планшетах и компьютерах.</p>
            <p>Обновления устанавливаются автоматически. Ваша команда всегда видит актуальную версию.</p>
          </div>
        )
      },
      {
        question: 'Можно ли интегрировать систему с 1С или аналитикой?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>Да. Мы предоставляем API и готовые интеграции с 1С, Google Sheets и Telegram-ботами.</p>
            <p>Команда внедрения помогает настроить обмен данными под ваши процессы.</p>
          </div>
        )
      },
      {
        question: 'Как быстро мы сможем запустить FloWix?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>Техническая готовность достигается за 1-2 дня. Основное время уходит на обучение сотрудников и загрузку справочников.</p>
            <p>Мы сопровождаем запуск и помогаем команде привыкнуть к системе.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'support',
    label: 'Поддержка',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5 0 9-4 9-9V7l-9-4-9 4v6c0 5 4 9 9 9z" />
        <path d="M8 15h0M12 15h0M16 15h0" />
      </svg>
    ),
    description: 'Обучение команды и сопровождение',
    items: [
      {
        question: 'Кто помогает команде освоить систему?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>За каждым проектом закрепляется менеджер внедрения. Он обучает сотрудников и отвечает на вопросы.</p>
            <p>Для новых сотрудников есть короткие видео-инструкции внутри приложения.</p>
          </div>
        )
      },
      {
        question: 'Как работает поддержка после запуска?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>Поддержка доступна 7 дней в неделю в Telegram. Среднее время ответа — до 10 минут в рабочее время.</p>
            <p>В срочных случаях мы подключаемся к вашей системе и помогаем решить задачу.</p>
          </div>
        )
      },
      {
        question: 'Если появятся новые задачи, кто их реализует?',
        answer: (
          <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>У нас есть студия разработки, которая развивает FloWix по запросу клиентов. Мы обсуждаем задачу и предлагаем решение с бюджетом.</p>
          </div>
        )
      }
    ]
  }
] as const;

type CategoryId = typeof faqCategories[number]['id'];

type QuestionState = {
  category: CategoryId;
  question: string;
} | null;

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>(faqCategories[0].id);
  const [expanded, setExpanded] = useState<QuestionState>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
        threshold: 0.2,
        rootMargin: '120px'
      }
    );

    observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const category = faqCategories.find((cat) => cat.id === activeCategory);
    if (category) {
      setExpanded(null);
    }
  }, [activeCategory]);

  const currentCategory = faqCategories.find((cat) => cat.id === activeCategory)!;

  const handleToggleQuestion = (question: string) => {
    setExpanded((prev) => {
      if (prev && prev.category === activeCategory && prev.question === question) {
        return null;
      }
      return { category: activeCategory, question };
    });
  };

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="relative h-screen w-screen flex-shrink-0 flex items-center snap-start overflow-x-hidden overflow-y-auto"
      style={{ paddingTop: '96px', paddingBottom: '32px' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          data-parallax-speed="50"
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[360px] h-[360px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-r from-[#FF9D66]/18 via-[#FF8040]/12 to-transparent rounded-full blur-3xl"></div>
        </div>
        <div
          data-parallax-speed="45"
          className="absolute bottom-1/3 right-[-150px] w-[460px] h-[460px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-br from-[#FF8040]/12 via-[#FF9D66]/8 to-transparent rounded-full blur-3xl"></div>
        </div>
      </div>

      <div className="container relative z-10 h-full flex flex-col justify-center">
        <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="mb-6 flex justify-center">
            <div className="w-full max-w-[680px] text-center">
              <SectionHeader
                badge="Вопросы и ответы"
                badgeIcon="❓"
                title="Часто задаваемые вопросы"
                highlightedWord="вопросы"
                align="center"
                animated={false}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-[980px] mx-auto">
            <div className="flex flex-wrap justify-center gap-2.5" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              {faqCategories.map((category) => {
                const isActive = category.id === activeCategory;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className="group relative overflow-hidden rounded-full transition-all duration-400 font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-black/5 dark:shadow-black/40 hover:shadow-xl"
                    style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '11px', paddingBottom: '11px' }}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF9D66] via-[#FF8040] to-[#FF9D66] shadow-lg shadow-[#FF9D66]/40"></span>
                    )}
                    {!isActive && (
                      <span className="absolute inset-0 rounded-full bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl"></span>
                    )}
                    <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                      <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'} text-[15px]`}>{category.icon}</span>
                      <span className="tracking-wide whitespace-nowrap">{category.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400" style={{ paddingLeft: '18px', paddingRight: '18px' }}>
              {currentCategory.description}
            </div>

            <div
              className={`relative rounded-[26px] bg-white/35 dark:bg-black/25 backdrop-blur-[18px] border border-white/30 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '22px', paddingBottom: '22px' }}
            >
              <div className="space-y-3">
                {currentCategory.items.map((item) => {
                  const isOpen = !!expanded && expanded.category === activeCategory && expanded.question === item.question;
                  return (
                    <div
                      key={item.question}
                      className={`rounded-[20px] border transition-all duration-500 ${
                        isOpen
                          ? 'bg-white/70 dark:bg-white/10 border-white/60 dark:border-white/20 shadow-lg shadow-[#FF9D66]/20'
                          : 'bg-white/20 dark:bg-white/5 border-white/40 dark:border-white/10 hover:bg-white/30 hover:dark:bg-white/10 hover:shadow-lg hover:shadow-black/10'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleQuestion(item.question)}
                        className="w-full flex items-start justify-between gap-3 text-left"
                        style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '14px', paddingBottom: '14px' }}
                      >
                        <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                          {item.question}
                        </span>
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full border border-white/35 dark:border-white/15 bg-white/35 dark:bg-white/5 transition-all duration-300 ${isOpen ? 'rotate-180 text-[#FF8040]' : 'text-gray-600 dark:text-gray-300'}`}>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </span>
                      </button>
                      <div className={`grid transition-all duration-500 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden" style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '14px' }}>
                          {item.answer}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

