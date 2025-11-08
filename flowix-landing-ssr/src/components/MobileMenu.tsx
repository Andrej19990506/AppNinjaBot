'use client';

import { useState } from 'react';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Burger Button - превращается в крестик */}
      <button
        onClick={toggleMenu}
        className="md:hidden w-12 h-12 flex flex-col items-center justify-center gap-1.5 bg-white/80 dark:bg-[#0D0D0D]/80 backdrop-blur-md rounded-full border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#1a1a1a] transition-colors relative z-[300]"
        aria-label="Toggle menu"
      >
        <span
          className={`w-6 h-0.5 bg-gray-900 dark:bg-white transition-all duration-300 ${
            isOpen ? 'rotate-45 translate-y-2' : ''
          }`}
        />
        <span
          className={`w-6 h-0.5 bg-gray-900 dark:bg-white transition-all duration-300 ${
            isOpen ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`w-6 h-0.5 bg-gray-900 dark:bg-white transition-all duration-300 ${
            isOpen ? '-rotate-45 -translate-y-2' : ''
          }`}
        />
      </button>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed top-0 left-0 right-0 bottom-0 z-[240] bg-white dark:bg-[#0D0D0D] transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        style={{ paddingTop: '120px' }}
      >
        <nav className="flex flex-col items-center justify-center h-full gap-8 text-2xl" style={{ marginTop: '-120px' }}>
          <a
            href="#hero"
            onClick={toggleMenu}
            className="text-gray-900 dark:text-white hover:text-[#FF9D66] transition-colors"
          >
            Главная
          </a>
          <a
            href="#features"
            onClick={toggleMenu}
            className="text-gray-900 dark:text-white hover:text-[#FF9D66] transition-colors"
          >
            Возможности
          </a>
          <a
            href="#benefits"
            onClick={toggleMenu}
            className="text-gray-900 dark:text-white hover:text-[#FF9D66] transition-colors"
          >
            Преимущества
          </a>
          <a
            href="#faq"
            onClick={toggleMenu}
            className="text-gray-900 dark:text-white hover:text-[#FF9D66] transition-colors"
          >
            FAQ
          </a>
          <a
            href="#contact"
            onClick={toggleMenu}
            className="text-gray-900 dark:text-white hover:text-[#FF9D66] transition-colors"
          >
            Контакты
          </a>
        </nav>
      </div>
    </>
  );
}

