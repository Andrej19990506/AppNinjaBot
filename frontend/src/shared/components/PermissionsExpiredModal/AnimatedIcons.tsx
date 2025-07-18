import React from 'react';
import styled, { keyframes } from 'styled-components';

// Анимации
const rotateShake = keyframes`
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(-10deg); }
  20% { transform: rotate(10deg); }
  30% { transform: rotate(-10deg); }
  40% { transform: rotate(10deg); }
  50% { transform: rotate(-5deg); }
  60% { transform: rotate(5deg); }
  70% { transform: rotate(-2deg); }
  80% { transform: rotate(2deg); }
  90% { transform: rotate(-1deg); }
`;

const pulseGlow = keyframes`
  0%, 100% { 
    filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.4));
    transform: scale(1);
  }
  50% { 
    filter: drop-shadow(0 0 20px rgba(255, 152, 0, 0.8));
    transform: scale(1.05);
  }
`;

const sandFlow = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
`;

const clockTick = keyframes`
  0% { transform: rotate(0deg); }
  25% { transform: rotate(90deg); }
  50% { transform: rotate(180deg); }
  75% { transform: rotate(270deg); }
  100% { transform: rotate(360deg); }
`;

const IconContainer = styled.div`
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: ${pulseGlow} 2s ease-in-out infinite;
`;

const ShieldIcon = styled.svg`
  width: 64px;
  height: 64px;
  animation: ${rotateShake} 3s ease-in-out infinite;
`;

const ClockIcon = styled.svg`
  width: 64px;
  height: 64px;
`;

const ClockHand = styled.path`
  animation: ${clockTick} 4s linear infinite;
  transform-origin: 32px 32px;
`;

const SandGrain = styled.circle`
  animation: ${sandFlow} 2s ease-in-out infinite;
`;

interface AnimatedIconProps {
  type: 'revoked' | 'expired';
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({ type }) => {
  if (type === 'revoked') {
    return (
      <IconContainer>
        <ShieldIcon viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Градиент для иконки */}
          <defs>
            <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="50%" stopColor="#FF5722" />
              <stop offset="100%" stopColor="#FF9800" />
            </linearGradient>
          </defs>
          
          {/* Щит */}
          <path
            d="M32 4C32 4 20 8 20 8C20 8 20 28 20 28C20 40 32 56 32 56C32 56 44 40 44 40C44 28 44 8 44 8C44 8 32 4 32 4Z"
            fill="url(#shieldGradient)"
            stroke="#FF5722"
            strokeWidth="2"
          />
          
          {/* Крестик */}
          <path
            d="M24 24L40 40M40 24L24 40"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Внутренний блеск */}
          <path
            d="M32 8C32 8 24 10 24 10C24 10 24 26 24 26C24 35 32 48 32 48"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="2"
          />
        </ShieldIcon>
      </IconContainer>
    );
  }

  if (type === 'expired') {
    return (
      <IconContainer>
        <ClockIcon viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Градиент для часов */}
          <defs>
            <linearGradient id="clockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFA726" />
              <stop offset="50%" stopColor="#FF9800" />
              <stop offset="100%" stopColor="#FF6F00" />
            </linearGradient>
          </defs>
          
          {/* Внешний круг */}
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="url(#clockGradient)"
            stroke="#FF6F00"
            strokeWidth="2"
          />
          
          {/* Внутренний круг */}
          <circle
            cx="32"
            cy="32"
            r="24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />
          
          {/* Часовые деления */}
          <g stroke="white" strokeWidth="2">
            <line x1="32" y1="8" x2="32" y2="12" />
            <line x1="56" y1="32" x2="52" y2="32" />
            <line x1="32" y1="56" x2="32" y2="52" />
            <line x1="8" y1="32" x2="12" y2="32" />
          </g>
          
          {/* Минутные деления */}
          <g stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1">
            <line x1="32" y1="10" x2="32" y2="11" />
            <line x1="54" y1="32" x2="53" y2="32" />
            <line x1="32" y1="54" x2="32" y2="53" />
            <line x1="10" y1="32" x2="11" y2="32" />
          </g>
          
          {/* Стрелки */}
          <ClockHand
            d="M32 32L32 18"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ClockHand
            d="M32 32L32 14"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Центр */}
          <circle
            cx="32"
            cy="32"
            r="3"
            fill="white"
          />
          
          {/* Песочные частицы для эффекта */}
          <g>
            <SandGrain cx="40" cy="20" r="1" fill="rgba(255, 255, 255, 0.8)" />
            <SandGrain cx="24" cy="44" r="1" fill="rgba(255, 255, 255, 0.6)" />
            <SandGrain cx="44" cy="40" r="1" fill="rgba(255, 255, 255, 0.4)" />
          </g>
        </ClockIcon>
      </IconContainer>
    );
  }

  return null;
}; 