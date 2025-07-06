import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface TemplateChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: {
    new_items: string[];
    removed_items: string[];
    summary: {
      added_items: number;
      removed_items: number;
      preserved_items: number;
    };
  };
}

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 20px;
`;

const ModalContainer = styled(motion.div)`
  background: var(--background-color);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
`;

const Header = styled.div`
  padding: 24px 24px 0;
  text-align: center;
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  opacity: 0.8;
`;

const Content = styled.div`
  padding: 20px 24px;
  max-height: 50vh;
  overflow-y: auto;
`;

const SummaryCard = styled.div`
  background: var(--primary-transparent);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--primary-color);
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  text-align: center;
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const SummaryNumber = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
`;

const SummaryLabel = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ChangesSection = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemCard = styled.div<{ type: 'added' | 'removed' }>`
  background: ${props => props.type === 'added' ? 'var(--success-transparent)' : 'var(--error-transparent)'};
  border: 1px solid ${props => props.type === 'added' ? 'var(--success-color)' : 'var(--error-color)'};
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ItemIcon = styled.div<{ type: 'added' | 'removed' }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.type === 'added' ? 'var(--success-color)' : 'var(--error-color)'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
`;

const ItemText = styled.div`
  font-size: 0.9rem;
  color: var(--text-color);
  font-weight: 500;
`;

const Footer = styled.div`
  padding: 0 24px 24px;
  text-align: center;
`;

const CloseButton = styled.button`
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;

  &:hover {
    background: var(--primary-light);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
`;

const TemplateChangesModal: React.FC<TemplateChangesModalProps> = ({
  isOpen,
  onClose,
  changes
}) => {
  const hasChanges = changes.new_items.length > 0 || changes.removed_items.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <ModalContainer
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Header>
              <Title>
                📝 Шаблон обновлён
              </Title>
              <Subtitle>
                Инвентарь синхронизирован с новым шаблоном
              </Subtitle>
            </Header>

            <Content>
              <SummaryCard>
                <SummaryGrid>
                  <SummaryItem>
                    <SummaryNumber>+{changes.summary.added_items}</SummaryNumber>
                    <SummaryLabel>Добавлено</SummaryLabel>
                  </SummaryItem>
                  <SummaryItem>
                    <SummaryNumber>-{changes.summary.removed_items}</SummaryNumber>
                    <SummaryLabel>Удалено</SummaryLabel>
                  </SummaryItem>
                  <SummaryItem>
                    <SummaryNumber>={changes.summary.preserved_items}</SummaryNumber>
                    <SummaryLabel>Сохранено</SummaryLabel>
                  </SummaryItem>
                </SummaryGrid>
              </SummaryCard>

              {hasChanges ? (
                <>
                  {changes.new_items.length > 0 && (
                    <ChangesSection>
                      <SectionTitle>
                        ✅ Добавленные позиции
                      </SectionTitle>
                      <ItemsList>
                        {changes.new_items.map((item, index) => (
                          <ItemCard key={`added-${index}`} type="added">
                            <ItemIcon type="added">+</ItemIcon>
                            <ItemText>{item}</ItemText>
                          </ItemCard>
                        ))}
                      </ItemsList>
                    </ChangesSection>
                  )}

                  {changes.removed_items.length > 0 && (
                    <ChangesSection>
                      <SectionTitle>
                        ❌ Удалённые позиции
                      </SectionTitle>
                      <ItemsList>
                        {changes.removed_items.map((item, index) => (
                          <ItemCard key={`removed-${index}`} type="removed">
                            <ItemIcon type="removed">-</ItemIcon>
                            <ItemText>{item}</ItemText>
                          </ItemCard>
                        ))}
                      </ItemsList>
                    </ChangesSection>
                  )}
                </>
              ) : (
                <EmptyState>
                  <div>🔄 Синхронизация завершена</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                    Изменений не обнаружено
                  </div>
                </EmptyState>
              )}
            </Content>

            <Footer>
              <CloseButton onClick={onClose}>
                ОК
              </CloseButton>
            </Footer>
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

export default TemplateChangesModal; 