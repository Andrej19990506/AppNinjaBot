import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Используем класс 'dark' для переключения темы
  theme: {
    extend: {
      colors: {
        // FloWix brand colors
        primary: {
          DEFAULT: '#FF8040',
          light: '#FFB88C',
          dark: '#FF9D66',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-down': 'fadeInDown 0.6s ease-out',
        'slide-in-left': 'slideInLeft 0.8s ease-out',
        'slide-in-right': 'slideInRight 0.8s ease-out',
        'bounce-subtle': 'bounceSubtle 3s ease-in-out infinite',
        'float': 'float 20s ease-in-out infinite',
        'float-delayed': 'floatDelayed 25s ease-in-out infinite',
        'float-device': 'floatDevice 6s ease-in-out infinite',
        'float-device-left': 'floatDeviceLeft 6s ease-in-out infinite',
        'float-device-right': 'floatDeviceRight 6.5s ease-in-out infinite',
        'float-icon': 'floatIcon 3s ease-in-out infinite',
        'float-icon-delayed': 'floatIcon 3s ease-in-out 0.5s infinite',
        'gradient': 'gradient 8s ease infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'logo-glow': 'logoGlow 3s ease-in-out infinite alternate',
        'pulse-slow': 'pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-100px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -30px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        floatDelayed: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-30px, 30px) scale(0.9)' },
          '66%': { transform: 'translate(20px, -20px) scale(1.1)' },
        },
        floatDevice: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotateZ(0deg)' },
          '25%': { transform: 'translateY(-8px) translateX(3px) rotateZ(1deg)' },
          '50%': { transform: 'translateY(-12px) translateX(0px) rotateZ(0deg)' },
          '75%': { transform: 'translateY(-8px) translateX(-3px) rotateZ(-1deg)' },
        },
        floatDeviceLeft: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-10px) translateX(-5px)' },
        },
        floatDeviceRight: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-12px) translateX(5px)' },
        },
        floatIcon: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(3deg)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 157, 102, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 157, 102, 0.6)' },
        },
        logoGlow: {
          '0%': { filter: 'drop-shadow(0 0 10px rgba(255, 128, 64, 0.5))' },
          '100%': { filter: 'drop-shadow(0 0 20px rgba(255, 128, 64, 0.8))' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      transitionDuration: {
        '800': '800ms',
      },
    },
  },
  plugins: [],
};

export default config;

