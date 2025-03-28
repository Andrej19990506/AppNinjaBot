import styled from 'styled-components';

export const MonthSectionContainer = styled.div`
    margin-bottom: 32px;
    max-width: 100%;
    overflow: visible;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
    box-sizing: border-box;
    position: relative;
    
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    
    @media (max-width: 480px) {
        margin-bottom: 24px;
    }
`;

export const MonthTitle = styled.h2`
    margin: 0 0 16px 0;
    color: var(--text-color);
    font-size: 1.2rem;
    text-align: center;
    font-weight: 500;
    letter-spacing: 0.5px;
    
    @media (max-width: 480px) {
        font-size: 1.1rem;
        margin: 0 0 12px 0;
    }
`;

export const WeekDaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
    text-align: center;
    max-width: 100%;
    padding: 0;
    width: 100%;
    
    @media (max-width: 480px) {
        gap: 1px;
    }
`;

export const WeekDay = styled.div`
    color: var(--text-secondary);
    font-size: 0.8rem;
    padding: 4px 0;
    text-transform: capitalize;
    font-weight: 500;
`;

export const DaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin: 0 auto;
    max-width: 100%;
    width: 100%;
    padding: 0;
    
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    
    @media (max-width: 480px) {
        gap: 1px;
    }
`; 