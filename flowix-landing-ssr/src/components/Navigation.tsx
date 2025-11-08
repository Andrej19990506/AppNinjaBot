'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const FeaturesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const BenefitsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const FAQIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9a3 3 0 1 1 4.24 2.83 2 2 0 0 0-1.24 1.84V14" />
    <line x1="12" y1="18" x2="12" y2="18" />
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const ContactIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h6" />
    <path d="m3 6 9 6 9-6" />
    <path d="M16 22s5-3.33 5-6a5 5 0 0 0-10 0c0 2.67 5 6 5 6Z" />
    <circle cx="16" cy="16" r="1" />
  </svg>
);

const navItems: NavItem[] = [
  { id: 'hero', label: 'Главная', icon: <HomeIcon /> },
  { id: 'features', label: 'Функционал', icon: <FeaturesIcon /> },
  { id: 'benefits', label: 'Преимущества', icon: <BenefitsIcon /> },
  { id: 'faq', label: 'FAQ', icon: <FAQIcon /> },
  { id: 'contact', label: 'Контакты', icon: <ContactIcon /> },
];

export default function Navigation() {
  const [activeSection, setActiveSection] = useState('hero');

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  const navTrackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });

  // Detect which section is currently visible с помощью IntersectionObserver
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root: main,
        threshold: [0.4, 0.6, 0.75],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // Обновляем позицию стеклянного индикатора
  useEffect(() => {
    const track = navTrackRef.current;
    const activeIndex = navItems.findIndex((item) => item.id === activeSection);
    const activeButton = buttonRefs.current[activeIndex];

    if (!track || !activeButton) return;

    const updateIndicator = () => {
      const trackRect = track.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        width: buttonRect.width,
        left: buttonRect.left - trackRect.left,
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);

    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeSection]);

  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50">
      {/* Glassmorphism Container */}
      <div className="relative">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF9D66]/30 via-[#FF8040]/30 to-[#FF9D66]/30 blur-xl opacity-60 rounded-full"></div>
        
        {/* Navigation Container */}
        <div 
          ref={navTrackRef}
          className="relative flex items-center gap-3 rounded-full bg-white/35 dark:bg-black/30 backdrop-blur-2xl border border-white/35 dark:border-white/20 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
          style={{ paddingLeft: '8px', paddingRight: '8px', paddingTop: '8px', paddingBottom: '8px' }}
        >
          <div
            className="pointer-events-none absolute top-1 bottom-1 rounded-full border border-white/55 dark:border-white/25 bg-white/65 dark:bg-white/15 backdrop-blur-2xl shadow-[0_16px_40px_rgba(255,95,31,0.28)] transition-[transform,width] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: indicatorStyle.width ? `${indicatorStyle.width}px` : 0,
              transform: `translateX(${indicatorStyle.left}px)`,
              opacity: indicatorStyle.width ? 1 : 0,
            }}
          ></div>
          {navItems.map((item, index) => {
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                className={`
                  group relative overflow-hidden rounded-full font-semibold text-sm tracking-wide
                  transition-colors duration-200
                  ${isActive 
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}
                style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '12px', paddingBottom: '12px' }}
              >
                {/* Content */}
                <span className="relative z-10 flex items-center gap-3">
                  <span className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_6px_14px_rgba(255,95,31,0.35)]' : ''}`}>
                    {item.icon}
                  </span>
                  <span className="transition-colors duration-300">{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Navigation Arrows */}
      <div className="absolute -left-16 top-1/2 -translate-y-1/2">
        <button
          onClick={() => {
            const currentIndex = navItems.findIndex(item => item.id === activeSection);
            if (currentIndex > 0) {
              scrollToSection(navItems[currentIndex - 1].id);
            }
          }}
          disabled={activeSection === navItems[0].id}
          className="group w-12 h-12 rounded-full bg-white/40 dark:bg-black/30 backdrop-blur-xl border border-white/40 dark:border-white/20 flex items-center justify-center hover:scale-110 hover:-translate-x-1 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[#FF9D66]/30"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300 group-hover:text-[#FF9D66] transition-colors">
            <path d="M15 18L9 12L15 6"/>
          </svg>
        </button>
      </div>
      
      <div className="absolute -right-16 top-1/2 -translate-y-1/2">
        <button
          onClick={() => {
            const currentIndex = navItems.findIndex(item => item.id === activeSection);
            if (currentIndex < navItems.length - 1) {
              scrollToSection(navItems[currentIndex + 1].id);
            }
          }}
          disabled={activeSection === navItems[navItems.length - 1].id}
          className="group w-12 h-12 rounded-full bg-white/40 dark:bg-black/30 backdrop-blur-xl border border-white/40 dark:border-white/20 flex items-center justify-center hover:scale-110 hover:translate-x-1 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[#FF9D66]/30"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300 group-hover:text-[#FF9D66] transition-colors">
            <path d="M9 18L15 12L9 6"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}

