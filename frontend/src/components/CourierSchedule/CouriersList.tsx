import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCouriers, selectCouriers, selectCouriersLoading, selectCouriersError } from '../../store/slices/courierSlice';
import { AppDispatch } from '../../store/store';

// Анимация для появления панели справа
const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

// Анимация для исчезновения панели
const slideOut = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
`;

// Overlay для затемнения фона
const Overlay = styled.div<{ $isVisible: boolean, $isClosing: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: ${props => props.$isVisible ? 'block' : 'none'};
  opacity: ${props => props.$isClosing ? 0 : 1};
  transition: opacity 0.3s ease;
`;

// Контейнер для панели
const SidePanel = styled.div<{ $isVisible: boolean, $isClosing: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 30%;
  background-color: #ffffff;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  padding: 20px;
  overflow-y: auto;
  animation: ${props => {
    if (props.$isVisible && !props.$isClosing) {
      return css`${slideIn} 0.3s forwards`;
    }
    if (props.$isClosing) {
      return css`${slideOut} 0.3s forwards`;
    }
    return 'none';
  }};
`;

// Заголовок панели
const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 10px;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-color, #333);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #888;
  &:hover {
    color: #333;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  font-size: 1rem;
  color: var(--text-color, #333);
`;

const ErrorMessage = styled.div`
  padding: 15px;
  background-color: rgba(255, 0, 0, 0.1);
  border-left: 3px solid red;
  color: #d32f2f;
  margin: 10px 0;
`;

interface CouriersListProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string | number;
  requesterId: string | number;
}

const CouriersList: React.FC<CouriersListProps> = ({ isOpen, onClose, groupId, requesterId }) => {
  const [isClosing, setIsClosing] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  
  // Получаем данные из Redux
  const couriers = useSelector(selectCouriers);
  const loading = useSelector(selectCouriersLoading);
  const error = useSelector(selectCouriersError);

  // Загружаем список курьеров при открытии панели
  useEffect(() => {
    if (isOpen && groupId && requesterId) {
      dispatch(fetchCouriers({ groupId, requesterId }));
    }
  }, [isOpen, groupId, requesterId, dispatch]);

  // Обрабатываем анимацию закрытия
  const handleClose = () => {
    setIsClosing(true);
    // Сразу вызываем onClose
    onClose();
    // После окончания анимации только сбрасываем состояние
    setTimeout(() => {
      setIsClosing(false);
    }, 300); // 300ms - длительность анимации
  };

  // Не рендерим компонент, если он не открыт и не в процессе закрытия
  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <>
      <Overlay 
        $isVisible={isOpen || isClosing} 
        $isClosing={isClosing} 
        onClick={handleClose}
      />
      
      <SidePanel 
        $isVisible={isOpen || isClosing} 
        $isClosing={isClosing}
      >
        <PanelHeader>
          <PanelTitle>Список курьеров</PanelTitle>
          <CloseButton onClick={handleClose}>&times;</CloseButton>
        </PanelHeader>

        {loading ? (
          <LoadingSpinner>Загрузка списка курьеров...</LoadingSpinner>
        ) : error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : (
          <div>
            <h4>Hello World!</h4>
            <p>Здесь будет список курьеров группы (id: {groupId})</p>
            <p>Количество курьеров: {couriers.length}</p>
          </div>
        )}
      </SidePanel>
    </>
  );
};

export default CouriersList; 