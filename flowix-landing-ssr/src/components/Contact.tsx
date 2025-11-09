'use client';

import { useEffect, useRef, useState } from 'react';

const contactMethods = [
  {
    title: 'Telegram',
    value: '@Flowix_support',
    href: 'https://t.me/Flowix_support',
    subtitle: 'Напишите в поддержку',
    highlight: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9 22 2Z" />
      </svg>
    )
  },
  {
    title: 'Телефон',
    value: '+7 (913) 584-96-01',
    href: 'tel:+79135849601',
    subtitle: 'Позвоните нам',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72c.12.94.35 1.86.69 2.73a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.87.34 1.79.57 2.73.69a2 2 0 0 1 1.72 2.01Z" />
      </svg>
    )
  },
  {
    title: 'Email',
    value: 'support@flowix.ru',
    href: 'mailto:support@flowix.ru',
    subtitle: 'Письменные обращения',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    )
  }
];

const Contact = () => {
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formStatus === 'loading') return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: (formData.get('name') as string) ?? '',
      company: (formData.get('company') as string) ?? '',
      phone: (formData.get('phone') as string) ?? '',
      points: (formData.get('points') as string) ?? '',
      message: (formData.get('message') as string) ?? '',
    };

    try {
      setFormStatus('loading');
      setFeedbackMessage(null);

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const detail =
          errorData && typeof errorData === 'object' && 'detail' in errorData && typeof errorData.detail === 'string'
            ? errorData.detail
            : 'Ошибка отправки. Попробуйте ещё раз.';
        throw new Error(detail);
      }

      const responseData = await response.json().catch(() => null);

      setFormStatus('success');
      setFeedbackMessage(
        responseData && typeof responseData === 'object' && 'detail' in responseData && typeof responseData.detail === 'string'
          ? responseData.detail
          : 'Спасибо! Мы свяжемся с вами в ближайшее время.',
      );
      form.reset();

      setTimeout(() => {
        setFormStatus('idle');
        setFeedbackMessage(null);
      }, 5000);
    } catch (error) {
      console.error('Ошибка отправки формы:', error);
      setFormStatus('error');
      const detail = error instanceof Error ? error.message : null;
      setFeedbackMessage(detail ?? 'Произошла ошибка. Напишите нам в Telegram @Flowix_support или попробуйте снова.');

      setTimeout(() => {
        setFormStatus('idle');
      }, 5000);
    }
  };

  useEffect(() => {
    const button = submitBtnRef.current;
    if (!button) return;

    const handleMouseEnter = () => {
      button.style.transition = 'none';
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const offsetX = event.clientX - rect.left - rect.width / 2;
      const offsetY = event.clientY - rect.top - rect.height / 2;

      button.style.transform = `translate(${offsetX * 0.25}px, ${offsetY * 0.25}px) scale(1.03)`;
    };

    const handleMouseLeave = () => {
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

  return (
    <section
      id="contact"
      className="relative h-screen w-screen flex-shrink-0 flex items-start md:items-center snap-start overflow-x-hidden overflow-y-auto"
      style={{ paddingTop: '110px', paddingBottom: '52px' }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          data-parallax-speed="65"
          className="absolute top-[6%] right-[8%] w-[480px] h-[480px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-br from-[#FF9D66]/18 via-[#FF8040]/14 to-transparent blur-[108px] rounded-full"></div>
        </div>
        <div
          data-parallax-speed="55"
          className="absolute bottom-[8%] left-[-140px] w-[560px] h-[560px]"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div className="w-full h-full bg-gradient-to-tr from-[#FF8040]/12 via-[#FF9D66]/10 to-transparent blur-[120px] rounded-full"></div>
        </div>
      </div>

      <div className="container relative z-10 h-full flex flex-col justify-start md:justify-center">
        <div className="w-full max-w-[1180px] mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 sm:gap-10 lg:gap-14 items-start">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/22 dark:bg-black/35 border border-white/35 dark:border-white/12 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/80 backdrop-blur-xl">
                  Контакты
                </div>
                <div className="space-y-4">
                  <h2 className="text-[36px] sm:text-[40px] lg:text-[44px] font-black leading-[1.05] text-white tracking-tight">
                    Свяжитесь с командой Flowix
                  </h2>
                  <p className="text-sm sm:text-[15px] text-white/85 leading-relaxed max-w-[520px]">
                    Ответим на вопросы, подскажем по внедрению и покажем, как автоматизация сэкономит время вашей команды.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                {contactMethods.map((method) => (
                  <a
                    key={method.title}
                    href={method.href}
                    target={method.href.startsWith('http') ? '_blank' : undefined}
                    rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={`group relative flex items-center justify-between rounded-[28px] border transition-all duration-300 backdrop-blur-xl ${
                      method.highlight
                        ? 'bg-white/22 dark:bg-black/35 border-white/35 dark:border-white/12 shadow-[0_24px_60px_rgba(255,128,64,0.25)] hover:shadow-[0_28px_70px_rgba(255,128,64,0.3)]'
                        : 'bg-white/22 dark:bg-black/32 border-white/28 dark:border-white/12 hover:bg-white/28 hover:dark:bg-black/40 hover:shadow-lg hover:shadow-black/15'
                    }`}
                    style={{ padding: '28px 34px' }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex items-center justify-center w-12 h-12 rounded-full border ${
                          method.highlight
                            ? 'border-white/65 bg-white/28 dark:bg-white/10 text-white'
                            : 'border-white/35 bg-white/24 dark:bg-white/10 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {method.icon}
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold text-white leading-tight">{method.title}</div>
                        <div className="text-xs text-white/75 leading-tight">{method.value}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/70">
                      <span className="uppercase tracking-[0.3em] text-[11px] text-white/65">{method.subtitle}</span>
                      <span className="flex items-center justify-center w-9 h-9 rounded-full border border-white/28 bg-white/16">
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                          <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-[1.5px] rounded-[32px] bg-gradient-to-br from-[#FF9D66]/18 via-transparent to-[#FF8040]/16 blur-[36px]"></div>
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="relative rounded-[32px] bg-white/22 dark:bg-black/35 backdrop-blur-2xl border border-white/35 dark:border-white/12 shadow-[0_24px_60px_rgba(255,128,64,0.25)]"
                style={{ padding: '40px 38px 44px' }}
              >
                <div className="space-y-7">
                  <div className="space-y-3">
                    <label
                      htmlFor="name"
                      className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/80"
                    >
                      Ваше имя
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Иван Иванов"
                      className="w-full rounded-[20px] bg-white/15 dark:bg-white/10 border border-white/30 dark:border-white/20 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/45 shadow-[0_14px_34px_rgba(17,24,39,0.18)] transition-all duration-300 focus:outline-none focus:border-[#FF9D66] focus:ring-2 focus:ring-[#FF9D66]/35 focus:bg-white/22 dark:focus:bg-white/14"
                      style={{ padding: '16px 24px' }}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <label
                      htmlFor="company"
                      className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/80"
                    >
                      Компания
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      placeholder="Название ресторана"
                      className="w-full rounded-[20px] bg-white/15 dark:bg-white/10 border border-white/30 dark:border-white/20 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/45 shadow-[0_14px_34px_rgba(17,24,39,0.18)] transition-all duration-300 focus:outline-none focus:border-[#FF9D66] focus:ring-2 focus:ring-[#FF9D66]/35 focus:bg-white/22 dark:focus:bg-white/14"
                      style={{ padding: '16px 24px' }}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label
                        htmlFor="phone"
                        className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/80"
                      >
                        Телефон
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+7 (999) 123-45-67"
                        className="w-full rounded-[20px] bg-white/15 dark:bg-white/10 border border-white/30 dark:border-white/20 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/45 shadow-[0_14px_34px_rgба(17,24,39,0.18)] transition-all duration-300 focus:outline-none focus:border-[#FF9D66] focus:ring-2 focus:ring-[#FF9D66]/35 focus:bg-white/22 dark:focus:bg-white/14"
                        style={{ padding: '16px 24px' }}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label
                        htmlFor="points"
                        className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/80"
                      >
                        Количество точек
                      </label>
                      <div className="relative">
                        <select
                          id="points"
                          name="points"
                          className="w-full appearance-none rounded-[20px] bg-white/15 dark:bg-white/10 border border-white/30 dark:border-white/20 text-base text-gray-900 dark:text-white shadow-[0_14px_34px_rgба(17,24,39,0.18)] transition-all duration-300 focus:outline-none focus:border-[#FF9D66] focus:ring-2 focus:ring-[#FF9D66]/35 focus:bg-white/22 dark:focus:bg-white/14"
                          style={{ padding: '16px 24px' }}
                        >
                          <option value="1">1 точка</option>
                          <option value="2-5">2-5 точек</option>
                          <option value="6-10">6-10 точек</option>
                          <option value="11-30">11-30 точек</option>
                          <option value="30+">30+ точек</option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[#FF9D66]">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label
                      htmlFor="message"
                      className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/80"
                    >
                      Сообщение
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      placeholder="Расскажите о вашем проекте..."
                      className="w-full rounded-[22px] bg-white/15 dark:bg-white/10 border border-white/30 dark:border-white/22 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/45 shadow-[0_16px_38px_rgба(17,24,39,0.2)] transition-all duration-300 focus:outline-none focus:border-[#FF9D66] focus:ring-2 focus:ring-[#FF9D66]/35 focus:bg-white/22 dark:focus:bg-white/14 resize-none"
                      style={{ padding: '20px 24px' }}
                    />
                  </div>

                  <button
                    ref={submitBtnRef}
                    type="submit"
                    disabled={formStatus === 'loading'}
                    className={`group relative inline-flex w-full sm:w-auto items-center justify-center rounded-[36px] text-lg font-semibold text-gray-900 dark:text-white backdrop-blur-xl border transition-all duration-300 whitespace-nowrap ${
                      formStatus === 'success'
                        ? 'bg-[#24c3a0]/80 border-[#24c3a0]/70 shadow-[0_14px_36px_rgba(36,195,160,0.35)]'
                        : formStatus === 'error'
                        ? 'bg-[#f87171]/80 border-[#f87171]/70 shadow-[0_14px_36px_rgba(248,113,113,0.35)]'
                        : 'bg-white/45 dark:bg-white/12 border-white/45 dark:border-white/25 hover:border-[#FF9D66]/45 shadow-[0_12px_30px_rgba(15,23,42,0.14)] hover:shadow-[0_18px_48px_rgba(255,95,31,0.3)]'
                    }`}
                    style={{ paddingLeft: '44px', paddingRight: '44px', paddingTop: '17px', paddingBottom: '17px', gap: '14px' }}
                  >
                    <span className="relative z-10">
                      {formStatus === 'loading'
                        ? 'Отправляем...'
                        : formStatus === 'success'
                        ? 'Отправлено!'
                        : formStatus === 'error'
                        ? 'Ошибка отправки'
                        : 'Отправить заявку'}
                    </span>
                    <svg
                      className="relative z-10 transition-transform duration-300"
                      width="24"
                      height="24"
                      viewBox="0 0 20 20"
                      fill="none"
                      style={{ transform: formStatus === 'loading' ? 'translateX(6px)' : undefined }}
                    >
                      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {formStatus === 'idle' && (
                      <span className="absolute inset-0 rounded-[36px] bg-gradient-to-r from-[#FF9D66]/18 via-[#FF9D66]/18 to-[#FF8040]/12 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                    )}
                  </button>

                  {feedbackMessage && (
                    <div
                      className={`text-xs sm:text-sm transition-opacity duration-300 ${
                        formStatus === 'error' ? 'text-red-200' : 'text-emerald-200'
                      }`}
                      aria-live="assertive"
                    >
                      {feedbackMessage}
                    </div>
                  )}

                  <p className="text-[11px] text-white/75">
                    Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности и обработкой персональных данных.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
