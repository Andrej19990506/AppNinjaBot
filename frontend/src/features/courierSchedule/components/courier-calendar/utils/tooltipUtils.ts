import { TooltipPosition } from '../../types';

export const calculateTooltipPosition = (
    element: Element,
    tooltipWidth: number,
    tooltipHeight: number
): TooltipPosition => {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 15;

    let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
    let arrowOffset = '50%';
    let top = 0;
    let left = 0;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    if (spaceAbove >= tooltipHeight + gap && spaceAbove >= spaceBelow) {
        position = 'top';
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowOffset = '50%';
    } else if (spaceBelow >= tooltipHeight + gap) {
        position = 'bottom';
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowOffset = '50%';
    } else if (spaceLeft >= tooltipWidth + gap && spaceLeft >= spaceRight) {
        position = 'left';
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        arrowOffset = '50%';
    } else {
        position = 'right';
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        arrowOffset = '50%';
    }

    // Корректировка позиции, чтобы тултип не выходил за пределы экрана
    if (left < 16) {
        const originalLeft = left;
        left = 16;
        
        if (position === 'top' || position === 'bottom') {
            const arrowLeftPixels = tooltipWidth / 2 + originalLeft - left;
            arrowOffset = `${arrowLeftPixels}px`;
        }
    } else if (left + tooltipWidth > viewportWidth - 16) {
        const originalLeft = left;
        left = viewportWidth - tooltipWidth - 16;
        
        if (position === 'top' || position === 'bottom') {
            const arrowLeftPixels = tooltipWidth / 2 + originalLeft - left;
            arrowOffset = `${arrowLeftPixels}px`;
        }
    }

    if (top < 16) {
        const originalTop = top;
        top = 16;
        
        if (position === 'left' || position === 'right') {
            const arrowTopPixels = tooltipHeight / 2 + originalTop - top;
            arrowOffset = `${arrowTopPixels}px`;
        }
    } else if (top + tooltipHeight > viewportHeight - 16) {
        const originalTop = top;
        top = viewportHeight - tooltipHeight - 16;
        
        if (position === 'left' || position === 'right') {
            const arrowTopPixels = tooltipHeight / 2 + originalTop - top;
            arrowOffset = `${arrowTopPixels}px`;
        }
    }

    return { top, left, position, arrowOffset };
}; 