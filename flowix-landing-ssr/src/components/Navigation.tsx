'use client';

import { useState, useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';

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

const BUBBLE_PADDING = 18;

export default function Navigation() {
  const [activeSection, setActiveSection] = useState('hero');
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [dragState, setDragState] = useState({ isDragging: false, offset: 0, pointerLeft: 0, pointerId: -1 });
  const [observerLocked, setObserverLocked] = useState(false);
  const indicatorTargetRef = useRef({ width: 0, left: 0 });
  const indicatorCurrentRef = useRef({ width: 0, left: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const bubbleSheenRef = useRef(0.5);
  const [bubbleSheen, setBubbleSheen] = useState(0.5);

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const animateBubble = () => {
    const current = indicatorCurrentRef.current;
    const target = indicatorTargetRef.current;
    const easing = 0.22;

    const nextWidth = current.width + (target.width - current.width) * easing;
    const nextLeft = current.left + (target.left - current.left) * easing;

    indicatorCurrentRef.current = { width: nextWidth, left: nextLeft };
    setIndicatorStyle({ width: nextWidth, left: nextLeft });

    const widthDiff = Math.abs(target.width - nextWidth);
    const leftDiff = Math.abs(target.left - nextLeft);

    if (widthDiff < 0.1 && leftDiff < 0.1) {
      indicatorCurrentRef.current = { ...target };
      setIndicatorStyle(target);
      stopAnimation();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(animateBubble);
  };

  const updateBubbleTarget = (left: number, width: number, immediate = false) => {
    const target = {
      width: Math.max(width, 0),
      left: Math.max(left, 0),
    };
    indicatorTargetRef.current = target;

    if (immediate) {
      indicatorCurrentRef.current = target;
      setIndicatorStyle(target);
      stopAnimation();
      return;
    }

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animateBubble);
    }
  };

  const updateBubbleSheen = (value: number, immediate = false) => {
    const clamped = Math.min(1, Math.max(0, value));
    bubbleSheenRef.current = clamped;
    if (immediate) {
      setBubbleSheen(clamped);
      return;
    }
    setBubbleSheen((prev) => (Math.abs(prev - clamped) > 0.02 ? clamped : prev));
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  const navTrackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Detect which section is currently visible с помощью IntersectionObserver
  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (observerLocked) {
          return;
        }

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.4, 0.6],
        rootMargin: '0px',
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [observerLocked]);

  useEffect(() => () => stopAnimation(), []);

  // Обновляем позицию стеклянного индикатора
  useEffect(() => {
    if (dragState.isDragging) return;
    const track = navTrackRef.current;
    const activeIndex = navItems.findIndex((item) => item.id === activeSection);
    const activeButton = buttonRefs.current[activeIndex];

    if (!track || !activeButton) return;

    const updateIndicator = () => {
      const trackRect = track.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      let width = buttonRect.width + BUBBLE_PADDING;
      let left = buttonRect.left - trackRect.left - BUBBLE_PADDING / 2;
      left = Math.max(0, Math.min(left, trackRect.width - width));

      updateBubbleTarget(left, width, !indicatorCurrentRef.current.width);
      if (!dragState.isDragging) {
        setDragState((prev) => {
          if (Math.abs(prev.pointerLeft - left) < 0.2) {
            return prev;
          }
          return { ...prev, pointerLeft: left };
        });
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);

    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeSection, dragState.isDragging]);

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const track = navTrackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      let newLeft = event.clientX - trackRect.left - dragState.offset;
      newLeft = Math.max(0, newLeft);
      const pointerX = event.clientX - trackRect.left;

      const metrics = buttonRefs.current
        .map((button) => {
          if (!button) return null;
          const rect = button.getBoundingClientRect();
          const width = rect.width + BUBBLE_PADDING;
          const center = rect.left + rect.width / 2 - trackRect.left;
          return { width, center };
        })
        .filter((item): item is { width: number; center: number } => Boolean(item));

      let targetWidth = indicatorTargetRef.current.width || indicatorCurrentRef.current.width || indicatorStyle.width;
      if (metrics.length) {
        let nearest = metrics[0];
        let minDist = Math.abs(pointerX - metrics[0].center);
        for (let i = 1; i < metrics.length; i++) {
          const dist = Math.abs(pointerX - metrics[i].center);
          if (dist < minDist) {
            minDist = dist;
            nearest = metrics[i];
          }
        }
        targetWidth = nearest.width;
      }

      const maxLeftForWidth = Math.max(trackRect.width - targetWidth, 0);
      const clampedLeft = Math.max(0, Math.min(newLeft, maxLeftForWidth));

      updateBubbleTarget(clampedLeft, targetWidth);
      const relativeSheen = targetWidth > 0 ? (pointerX - clampedLeft) / targetWidth : 0.5;
      updateBubbleSheen(relativeSheen);

      const bubbleCenterWithinTrack = clampedLeft + targetWidth / 2;
      const trackWidth = Math.max(trackRect.width, 1);
      const progress = Math.min(1, Math.max(0, bubbleCenterWithinTrack / trackWidth));

      const main = document.querySelector('main');
      if (main) {
        const maxScroll = Math.max(main.scrollWidth - main.clientWidth, 0);
        const targetScrollLeft = progress * maxScroll;
        if (!Number.isNaN(targetScrollLeft)) {
          main.scrollLeft = targetScrollLeft;
        }
      }

      const interpolatedIndex = progress * (navItems.length - 1);
      const nearestIndex = Math.round(interpolatedIndex);
      const nextSectionId = navItems[Math.min(Math.max(nearestIndex, 0), navItems.length - 1)].id;
      if (nextSectionId !== activeSection) {
        setActiveSection(nextSectionId);
      }

      setDragState((prev) => {
        if (Math.abs(prev.pointerLeft - clampedLeft) < 0.2) {
          return prev;
        }
        return { ...prev, pointerLeft: clampedLeft };
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      try {
        navTrackRef.current?.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignore */
      }

      const track = navTrackRef.current;
      if (!track) {
        setDragState((prev) => ({ ...prev, isDragging: false, pointerId: -1 }));
        return;
      }

      const trackRect = track.getBoundingClientRect();
      const currentWidth = indicatorTargetRef.current.width || indicatorCurrentRef.current.width || indicatorStyle.width;
      const bubbleCenter = trackRect.left + dragState.pointerLeft + currentWidth / 2;

      let nearestIndex = 0;
      let minDistance = Infinity;

      buttonRefs.current.forEach((button, index) => {
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const distance = Math.abs(center - bubbleCenter);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const targetButton = buttonRefs.current[nearestIndex];
      if (targetButton) {
        const buttonRect = targetButton.getBoundingClientRect();
        const width = buttonRect.width + BUBBLE_PADDING;
        const maxLeftForWidth = Math.max(trackRect.width - width, 0);
        const left = Math.max(0, Math.min(buttonRect.left - trackRect.left - BUBBLE_PADDING / 2, maxLeftForWidth));
        updateBubbleTarget(left, width);
        setDragState((prev) => {
          if (Math.abs(prev.pointerLeft - left) < 0.2) {
            return prev;
          }
          return { ...prev, pointerLeft: left };
        });
      }

      const targetSection = navItems[nearestIndex].id;
      setDragState((prev) => ({ ...prev, isDragging: false, pointerId: -1 }));
      setActiveSection(targetSection);

      requestAnimationFrame(() => {
        scrollToSection(targetSection);
      });

      setTimeout(() => {
        setObserverLocked(false);
      }, 450);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState.isDragging, dragState.offset, dragState.pointerLeft, indicatorStyle.width, activeSection]);

  const beginDrag = (clientX: number, pointerId: number) => {
    const track = navTrackRef.current;
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const currentLeft = indicatorCurrentRef.current.left;
    const offset = clientX - (trackRect.left + currentLeft);

    setObserverLocked(true);
    setDragState({ isDragging: true, offset, pointerLeft: currentLeft, pointerId });
    track.setPointerCapture(pointerId);
  };

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = navTrackRef.current;
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const localX = event.clientX - trackRect.left;
    const localY = event.clientY - trackRect.top;

    const indicatorHeight = Math.max(trackRect.height - 12, 0);
    const verticalPadding = (trackRect.height - indicatorHeight) / 2;
    const indicatorTop = verticalPadding;
    const indicatorBottom = indicatorTop + indicatorHeight;
    const indicatorLeft = indicatorCurrentRef.current.left;
    const indicatorRight = indicatorLeft + (indicatorCurrentRef.current.width || indicatorStyle.width);

    const isWithinIndicator =
      localX >= indicatorLeft &&
      localX <= indicatorRight &&
      localY >= indicatorTop &&
      localY <= indicatorBottom;

    if (!isWithinIndicator) return;

    event.preventDefault();
    event.stopPropagation();

    beginDrag(event.clientX, event.pointerId);
  };

  const handleIndicatorPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    beginDrag(event.clientX, event.pointerId);
  };

  const handleButtonPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, isActive: boolean) => {
    if (!isActive) return;
    event.preventDefault();
    beginDrag(event.clientX, event.pointerId);
  };

  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 hidden lg:block">
      {/* Glassmorphism Container */}
      <div className="relative">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF9D66]/30 via-[#FF8040]/30 to-[#FF9D66]/30 blur-xl opacity-60 rounded-full"></div>
        
        {/* Navigation Container */}
        <div 
          ref={navTrackRef}
          onPointerDown={handleTrackPointerDown}
          className="relative flex items-center gap-3 rounded-full bg-white/35 dark:bg-black/30 backdrop-blur-2xl border border-white/35 dark:border-white/20 shadow-[0_24px_60px_rgба(15,23,42,0.18)]"
          style={{ paddingLeft: '8px', paddingRight: '8px', paddingTop: '8px', paddingBottom: '8px' }}
        >
          <div
            onPointerDown={handleIndicatorPointerDown}
            className={`absolute top-1/2 -translate-y-1/2 h-[calc(100%-12px)] rounded-full transition-[transform,width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${dragState.isDragging ? 'shadow-[0_18px_48px_rgба(255,95,31,0.35)] scale-[1.02] cursor-grabbing' : 'shadow-[0_16px_40px_rgба(255,95,31,0.28)] cursor-grab'} pointer-events-auto`}
            style={{
              width: indicatorStyle.width ? `${indicatorStyle.width}px` : 0,
              transform: `translateX(${indicatorStyle.left}px)`,
              opacity: indicatorStyle.width ? 1 : 0,
            }}
          >
            <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/15 dark:via-white/10 dark:to-white/5 backdrop-blur-3xl"></span>
            <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/70 dark:border-white/20 opacity-80"></span>
            <span className="pointer-events-none absolute inset-[6px] rounded-full bg-gradient-to-br from-white/40 via-transparent to-white/25 dark:from-white/10 dark:via-transparent dark:to-white/5 opacity-70"></span>
          </div>
          {navItems.map((item, index) => {
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                onPointerDown={(event) => handleButtonPointerDown(event, isActive)}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                className={`
                  group relative overflow-hidden rounded-full font-semibold text-sm tracking-wide
                  transition-colors duration-200
                  ${isActive ? (dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}
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
    </nav>
  );
}

