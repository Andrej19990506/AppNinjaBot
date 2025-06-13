import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';

const DropdownWrapper = styled(motion.div)<{ $top?: number; $left?: number }>`
  position: absolute;
  min-width: 260px;
  background: var(--card-background);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  border: 1.5px solid var(--border-color);
  z-index: 2002;
  padding: 0;
  overflow: hidden;
  top: ${({ $top }) => ($top !== undefined ? `${$top}px` : 'auto')};
  left: ${({ $left }) => ($left !== undefined ? `${$left}px` : 'auto')};
  @media (max-width: 600px) {
    min-width: 90vw;
    left: 5vw !important;
    top: ${({ $top }) => ($top !== undefined ? `${$top}px` : 'auto')};
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 10px 24px;
  font-size: 1.13rem;
  font-weight: 700;
  color: var(--text-color);
  background: var(--card-background);
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 2px 4px;
  margin-left: 8px;
  border-radius: 50%;
  transition: background 0.15s;
  &:hover {
    background: var(--hover-overlay);
    color: var(--primary-color);
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 0 0 0 0;
`;

const List = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 6px 0 10px 0;
`;

const Item = styled(motion.div)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 28px 12px 28px;
  cursor: pointer;
  background: ${({ $active }) => $active ? 'var(--primary-transparent)' : 'transparent'};
  color: ${({ $active }) => $active ? 'var(--primary-color)' : 'var(--text-color)'};
  font-weight: ${({ $active }) => $active ? 600 : 400};
  border-left: ${({ $active }) => $active ? '4px solid var(--primary-color)' : '4px solid transparent'};
  transition: background 0.18s, color 0.18s, border-left 0.18s;
  position: relative;
  &:hover {
    background: var(--hover-overlay);
    color: var(--primary-color);
  }
`;

const CheckIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  color: var(--primary-color);
  font-size: 1.2em;
`;

interface GroupFilterDropdownProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  groups: any[];
  selectedGroupId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } })
};

const GroupFilterDropdown: React.FC<GroupFilterDropdownProps> = ({ open, anchorEl, groups, selectedGroupId, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + rect.width / 2 - 130, // 260px ширина
      });
    }
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorEl]);

  return (
    <AnimatePresence>
      {open && (
        <DropdownWrapper
          ref={ref}
          $top={coords.top}
          $left={coords.left}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
        >
          <Header>
            Фильтр по группе
            <CloseBtn onClick={onClose} aria-label="Закрыть фильтр">×</CloseBtn>
          </Header>
          <Divider />
          <List initial="hidden" animate="visible" exit="hidden">
            <Item
              $active={!selectedGroupId}
              onClick={() => onSelect(null)}
              variants={itemVariants}
              custom={0}
            >
              Все группы
              {!selectedGroupId && <CheckIcon>✔</CheckIcon>}
            </Item>
            <Divider />
            {groups.map((g, i) => (
              <Item
                key={g.chat_id}
                $active={String(g.chat_id) === selectedGroupId}
                onClick={() => onSelect(String(g.chat_id))}
                variants={itemVariants}
                custom={i + 1}
              >
                {g.chat_title || g.title || `Чат ${g.chat_id}`}
                {String(g.chat_id) === selectedGroupId && <CheckIcon>✔</CheckIcon>}
              </Item>
            ))}
          </List>
        </DropdownWrapper>
      )}
    </AnimatePresence>
  );
};

export default GroupFilterDropdown; 