import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  min-height: 400px;
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  margin: 24px 0;
`;

const Icon = styled(motion.div)`
  font-size: 4rem;
  color: var(--warning-color);
  margin-bottom: 24px;
  filter: drop-shadow(0 4px 8px rgba(255, 193, 7, 0.3));
`;

const Title = styled.h2`
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  line-height: 1.4;
`;

const Description = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0 0 24px 0;
  max-width: 500px;
`;

const BranchName = styled.span`
  color: var(--primary-color);
  font-weight: 600;
  background: rgba(var(--primary-rgb), 0.1);
  padding: 2px 8px;
  border-radius: 4px;
`;

const ContactInfo = styled.div`
  border-radius: var(--radius);
  padding: 20px;
  margin-top: 16px;
  max-width: 400px;
`;

const ContactTitle = styled.h3`
  color: var(--warning-color);
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
`;

const ContactText = styled.p`
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const SupportLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--primary-color);
  color: var(--text-color-on-primary);
  font-weight: 600;
  font-size: 1.05rem;
  padding: 12px 24px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  
  &:hover {
    background: var(--primary-dark);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px) scale(1.03);
  }
`;

const TelegramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#229ED9"/>
    <path d="M180.5 74.5L157.5 180.5C157.5 180.5 154.5 188.5 146.5 185.5L104.5 153.5L87.5 166.5C87.5 166.5 86 167.5 84.5 167.5L87.5 143.5L157.5 87.5C157.5 87.5 160.5 85.5 157.5 84.5C154.5 83.5 151.5 85.5 151.5 85.5L72.5 120.5C72.5 120.5 69.5 121.5 70.5 124.5C71.5 127.5 75.5 128.5 75.5 128.5L99.5 135.5L146.5 104.5C146.5 104.5 148.5 103.5 149.5 105.5C150.5 107.5 148.5 109.5 148.5 109.5L110.5 143.5L110.5 143.5" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface Props {
  branchName: string;
}

const ConfigMissing: React.FC<Props> = ({ branchName }) => {
  return (
    <Container
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Icon
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        ⚠️
      </Icon>
      
      <Title>
        Конфигурация поставок не настроена
      </Title>
      
      <Description>
        Для филиала <BranchName>{branchName}</BranchName> не настроена 
        конфигурация подключения к таблицам поставок. 
        Без этой настройки невозможно загрузить данные о поставках.
      </Description>
      
      <ContactInfo>
        <ContactTitle>
           Что делать?
        </ContactTitle>
        <ContactText>
          Обратитесь в техническую поддержку для настройки 
          интеграции с Google Sheets для филиала <strong>{branchName}</strong>.
        </ContactText>
        
        <SupportLink href="https://t.me/+Sc8qu36mX-IwM2My" target="_blank" rel="noopener noreferrer">
          <TelegramIcon />
          NinjaPizzaBot Тех. Поддержка
        </SupportLink>
      </ContactInfo>
    </Container>
  );
};

export default ConfigMissing;
