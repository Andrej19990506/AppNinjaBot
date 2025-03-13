import { TweenVars, TimelineVars } from 'gsap/gsap-core';

declare module 'gsap' {
  export interface GSAPTweenVars {
    [key: string]: any;
    duration?: number;
    ease?: string;
    delay?: number;
    onComplete?: () => void;
    onStart?: () => void;
    onUpdate?: () => void;
    onRepeat?: () => void;
  }

  export interface GSAPTimeline {
    to: (target: any, vars: GSAPTweenVars) => GSAPTimeline;
    from: (target: any, vars: GSAPTweenVars) => GSAPTimeline;
    fromTo: (target: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars) => GSAPTimeline;
    kill: () => void;
    duration: () => number;
    progress: (value?: number) => number;
    pause: () => GSAPTimeline;
    resume: () => GSAPTimeline;
    reverse: () => GSAPTimeline;
    restart: () => GSAPTimeline;
    fromTo(
      targets: gsap.TweenTarget,
      fromVars: TweenVars,
      toVars: TweenVars,
      position?: string | number
    ): this;
    to(
      targets: gsap.TweenTarget,
      vars: TweenVars,
      position?: string | number
    ): this;
  }

  export interface GSAPTween {
    kill: () => void;
    duration: () => number;
    progress: (value?: number) => number;
    pause: () => GSAPTween;
    resume: () => GSAPTween;
    reverse: () => GSAPTween;
    restart: () => GSAPTween;
    timeScale: (value: number) => GSAPTween;
  }

  export interface GSAPStatic {
    to: (target: any, vars: GSAPTweenVars) => GSAPTween;
    from: (target: any, vars: GSAPTweenVars) => GSAPTween;
    fromTo: (target: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars) => GSAPTween;
    timeline: (vars?: TimelineVars) => GSAPTimeline;
    registerPlugin: (...args: any[]) => void;
    set: (target: any, vars: GSAPTweenVars) => void;
    getProperty: (target: any, property: string) => any;
    getTweensOf: (target: any) => GSAPTween[];
    killTweensOf: (target: any) => void;
  }

  const gsap: GSAPStatic;
  export default gsap;
}

declare module 'gsap/ScrollTrigger' {
  interface ScrollTriggerInstance {
    kill: () => void;
    enable: () => void;
    disable: () => void;
    refresh: () => void;
  }

  interface ScrollTriggerVars {
    trigger?: string | Element;
    start?: string | number | (() => string | number);
    end?: string | number | (() => string | number);
    onEnter?: (self: ScrollTriggerInstance) => void;
    onLeave?: (self: ScrollTriggerInstance) => void;
    onEnterBack?: (self: ScrollTriggerInstance) => void;
    onLeaveBack?: (self: ScrollTriggerInstance) => void;
    markers?: boolean;
    toggleClass?: string;
    toggleActions?: string;
    scrub?: boolean | number;
    pin?: boolean | string | Element;
    pinSpacing?: boolean | string;
  }

  interface ScrollTriggerStatic {
    batch: (
      targets: string | Element | Element[],
      vars: {
        onEnter?: (elements: Element[], triggers: ScrollTriggerInstance[]) => void;
        onLeave?: (elements: Element[], triggers: ScrollTriggerInstance[]) => void;
        onEnterBack?: (elements: Element[], triggers: ScrollTriggerInstance[]) => void;
        onLeaveBack?: (elements: Element[], triggers: ScrollTriggerInstance[]) => void;
        start?: string;
        end?: string;
        toggleActions?: string;
      }
    ) => void;
    create: (vars: ScrollTriggerVars) => ScrollTriggerInstance;
    getAll: () => ScrollTriggerInstance[];
    refresh: (hard?: boolean) => void;
    update: (soft?: boolean) => void;
    clearMatchMedia: (query?: string) => void;
    enable: (reset?: boolean, refresh?: boolean) => void;
    disable: (reset?: boolean) => void;
    kill: () => void;
  }

  const ScrollTrigger: ScrollTriggerStatic;
  export default ScrollTrigger;
} 