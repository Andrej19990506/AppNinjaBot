'use client';

import { useEffect, useRef, useState } from 'react';

interface SectionHeaderProps {
  badge?: string;
  badgeIcon?: string;
  title: string;
  highlightedWord?: string;
  description?: string;
  align?: 'left' | 'center' | 'right';
  animated?: boolean;
}

export default function SectionHeader({
  badge,
  badgeIcon,
  title,
  highlightedWord,
  description,
  align = 'center',
  animated = true
}: SectionHeaderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated || !headerRef.current) return;

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
        rootMargin: '50px'
      }
    );

    observer.observe(headerRef.current);

    return () => {
      if (headerRef.current) {
        observer.unobserve(headerRef.current);
      }
    };
  }, [animated]);

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  const renderTitle = () => {
    if (!highlightedWord) {
      return <span>{title}</span>;
    }

    const parts = title.split(highlightedWord);
    return (
      <>
        <span>{parts[0]}</span>
        <span className="bg-gradient-to-r from-[#FF9D66] via-[#FF8040] to-[#FF9D66] dark:from-[#FFB88C] dark:via-[#FF9D66] dark:to-[#FFB88C] bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
          {highlightedWord}
        </span>
        <span>{parts[1]}</span>
      </>
    );
  };

  return (
    <div 
      ref={headerRef}
      className={`${alignmentClasses[align]} mb-16 lg:mb-24 transition-all duration-1000 ${
        animated && isVisible ? 'opacity-100 translate-y-0' : animated ? 'opacity-0 translate-y-8' : ''
      }`}
    >
      {/* Badge */}
      {badge && (
        <div 
          className={`inline-flex mb-6 transition-all duration-700 ${
            animated && isVisible ? 'opacity-100 translate-y-0' : animated ? 'opacity-0 translate-y-4' : ''
          }`}
          style={animated ? { transitionDelay: '0ms' } : {}}
        >
          <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#FF9D66]/15 via-[#FF9D66]/20 to-[#FF9D66]/15 dark:from-[#FF9D66]/25 dark:via-[#FF9D66]/35 dark:to-[#FF9D66]/25 text-[#FF8040] dark:text-[#FFB88C] rounded-full text-sm font-bold backdrop-blur-sm border border-[#FF9D66]/25 dark:border-[#FF9D66]/40 shadow-lg shadow-[#FF9D66]/10 dark:shadow-[#FF9D66]/20 hover:scale-105 transition-transform duration-300 cursor-default">
            {badgeIcon && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF8040] dark:bg-[#FFB88C] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF8040] dark:bg-[#FFB88C]"></span>
              </span>
            )}
            {badgeIcon || ''} {badge}
          </span>
        </div>
      )}

      {/* Title */}
      <h2 
        className={`text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-[1.1] tracking-tight text-gray-900 dark:text-white transition-all duration-800 ${
          animated && isVisible ? 'opacity-100 translate-y-0' : animated ? 'opacity-0 translate-y-6' : ''
        }`}
        style={animated ? { transitionDelay: '150ms' } : {}}
      >
        {renderTitle()}
      </h2>

      {/* Description */}
      {description && (
        <p 
          className={`text-xl sm:text-2xl lg:text-[26px] leading-relaxed max-w-3xl text-gray-700 dark:text-gray-300 ${align === 'center' ? 'mx-auto text-center' : ''} transition-all duration-800 ${
            animated && isVisible ? 'opacity-100 translate-y-0' : animated ? 'opacity-0 translate-y-6' : ''
          }`}
          style={animated ? { transitionDelay: '300ms' } : {}}
        >
          {description}
        </p>
      )}
    </div>
  );
}

