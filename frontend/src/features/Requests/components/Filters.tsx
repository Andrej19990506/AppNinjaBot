import React from 'react';
import styled, { keyframes } from 'styled-components';

type Props = {
  date: string;
  onDateChange: (v: string) => void;
};

// Анимации
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;


// Стилизованные компоненты
const FiltersCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 
              0 2px 8px rgba(0, 0, 0, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
  padding: 24px;
  margin-bottom: 24px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
  overflow: hidden;
  animation: ${slideIn} 0.5s ease-out;
  transition: all var(--transition-normal);

  &:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 
                0 4px 12px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      var(--primary-color) 50%, 
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 16px;
    gap: 16px;
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
  
  @media (max-width: 768px) {
    min-width: auto;
  }
`;

const LabelText = styled.span`
  font-size: 0.875rem;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color var(--transition-normal);
  
  &::before {
    content: '📅';
    font-size: 1rem;
    filter: grayscale(0.3);
    transition: filter var(--transition-normal);
  }
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-color);
  font-weight: 500;
  cursor: pointer;
  transition: color var(--transition-fast);
  
  &:hover {
    color: var(--primary-color);
    
    ${LabelText} {
      color: var(--primary-color);
      
      &::before {
        filter: grayscale(0);
        transform: scale(1.1);
      }
    }
  }
`;

const DateInput = styled.input`
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--text-color);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  font-size: 1rem;
  font-weight: 500;
  transition: all var(--transition-normal);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
  
  &:focus {
    outline: none;
    border-color: rgba(var(--primary-rgb), 0.5);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1),
                0 4px 12px rgba(var(--primary-rgb), 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.08);
  }
  
  &:hover {
    border-color: rgba(var(--primary-rgb), 0.3);
    background: rgba(255, 255, 255, 0.08);
  }

  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    filter: invert(0.6);
    transition: filter var(--transition-normal);
    
    &:hover {
      filter: invert(0.8);
    }
  }

  &::-webkit-datetime-edit-text {
    color: var(--text-color);
  }

  &::-webkit-datetime-edit-month-field,
  &::-webkit-datetime-edit-day-field,
  &::-webkit-datetime-edit-year-field {
    color: var(--text-color);
  }
`;


const FilterIcon = styled.div`
  position: absolute;
  top: 16px;
  right: 20px;
  color: var(--primary-color);
  font-size: 1.4rem;
  opacity: 0.6;
  transition: all var(--transition-normal);
  
  &:hover {
    opacity: 1;
    transform: scale(1.1);
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const Filters: React.FC<Props> = ({ date, onDateChange }) => {
  return (
    <FiltersCard>
      <FilterIcon>🔍</FilterIcon>
      
      <FilterGroup>
        <Label>
          <LabelText>Дата заявки</LabelText>
          <DateInput 
            type="date" 
            value={date} 
            onChange={e => onDateChange(e.target.value)} 
          />
        </Label>
      </FilterGroup>
    </FiltersCard>
  );
};

export default Filters;


