import styled from 'styled-components';
import { Z_INDICES } from '../../constants';

export const HeaderContainer = styled.div`
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    background: var(--card-background);
    border-bottom: 1px solid var(--border-color);
    z-index: ${Z_INDICES.CALENDAR_HEADER};
    width: 100%;
`;

export const HeaderTop = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    width: 100%;
`;

export const Title = styled.h1`
    margin: 0;
    color: var(--text-color);
    font-size: 1.5rem;
    text-align: center;
    
    @media (max-width: 480px) {
        font-size: 1.2rem;
    }
`;

export const CloseButton = styled.button`
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
        background: var(--hover-color);
    }

    &:active {
        transform: scale(0.95);
    }
`;

export const SlotsContainer = styled.div`
    position: relative;
    width: 100%;
    background-color: var(--background-secondary);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) transparent;
    
    &::-webkit-scrollbar {
        display: block;
        height: 3px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
        background-color: var(--primary-color);
        border-radius: 3px;
        
        &:hover {
            background-color: var(--primary-hover);
        }
    }
`;

export const SlotsInfo = styled.div`
    display: inline-flex;
    padding: 12px 16px;
    gap: 8px;
    min-width: min-content;
    width: auto;
`;

export const DaySlots = styled.div`
    text-align: center;
    flex: 0 0 80px;
    position: relative;
    cursor: pointer;
    padding: 8px 4px;
    border-radius: var(--radius);
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--hover-color);
    }
`;

export const DayName = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
`;

export const SlotCount = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
`;

export const SlotBadge = styled.div`
    background-color: var(--primary-color);
    color: white;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    min-width: 24px;
`;

export const SlotDivider = styled.span`
    color: var(--text-secondary);
    font-weight: 500;
`; 