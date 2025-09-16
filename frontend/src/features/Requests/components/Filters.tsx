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
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
  overflow: hidden;
  animation: ${slideIn} 0.5s ease-out;
  transition: all var(--transition-normal);

  &:hover {
    box-shadow: var(--shadow-md);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--gradient-primary);
  }

  @media (max-width: 768px) {
    padding: 12px;
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
  }
`;

const LabelText = styled.span`
  font-size: 0.875rem;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 600;
`;

const DateInput = styled.input`
  background: var(--background-color);
  color: var(--text-color);
  border: 2px solid var(--border-color);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 1rem;
  font-weight: 500;
  transition: all var(--transition-normal);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-transparent);
    background: var(--card-background);
  }
  
  &:hover {
    border-color: var(--primary-light);
  }
`;


const FilterIcon = styled.div`
  position: absolute;
  top: 12px;
  right: 16px;
  color: var(--primary-color);
  font-size: 1.2rem;
  opacity: 0.7;
  
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
          <LabelText>📅 Дата заявки</LabelText>
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


