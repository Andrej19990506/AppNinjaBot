'use client';

import { useEffect } from 'react';

export default function HorizontalScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    if (!mediaQuery.matches) {
      return;
    }

    const main = document.querySelector('main');
    if (!main) return;

    const parallaxElements = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax-speed]'));
    let rafId = 0;

    const updateParallax = () => {
      const viewportCenter = window.innerWidth / 2;

      parallaxElements.forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed ?? 0);
        if (!speed) return;

        const rect = el.getBoundingClientRect();
        const elementCenter = rect.left + rect.width / 2;
        const distanceRatio = (viewportCenter - elementCenter) / viewportCenter;

        const translateX = distanceRatio * speed;
        const translateY = distanceRatio * speed * 0.35;

        el.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      });

      rafId = 0;
    };

    const requestParallaxUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(updateParallax);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      main.scrollLeft += e.deltaY;
      requestParallaxUpdate();
    };

    updateParallax();

    main.addEventListener('wheel', handleWheel, { passive: false });
    main.addEventListener('scroll', requestParallaxUpdate, { passive: true });
    window.addEventListener('resize', requestParallaxUpdate);

    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        main.removeEventListener('wheel', handleWheel);
        main.removeEventListener('scroll', requestParallaxUpdate);
        window.removeEventListener('resize', requestParallaxUpdate);
        if (rafId) cancelAnimationFrame(rafId);
      }
    };

    mediaQuery.addEventListener('change', handleBreakpointChange);

    return () => {
      main.removeEventListener('wheel', handleWheel);
      main.removeEventListener('scroll', requestParallaxUpdate);
      window.removeEventListener('resize', requestParallaxUpdate);
      mediaQuery.removeEventListener('change', handleBreakpointChange);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

