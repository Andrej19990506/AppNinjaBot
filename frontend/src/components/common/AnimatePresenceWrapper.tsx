import React from 'react';
import { AnimatePresence } from 'framer-motion';

interface AnimatePresenceWrapperProps {
    children: React.ReactNode;
    mode?: "sync" | "wait" | "popLayout";
}

// Обход проблемы типизации AnimatePresence
// Проблема в том, что AnimatePresence может возвращать undefined, что не соответствует ожиданиям React.FC
const AnimatePresenceWrapper: React.FC<AnimatePresenceWrapperProps> = ({ children, mode = "wait" }) => {
    // Оборачиваем в дополнительный div для обеспечения валидного JSX возвращаемого значения
    return (
        <div className="animate-presence-wrapper">
            {/* @ts-ignore: Ignoring type errors with AnimatePresence */}
            <AnimatePresence mode={mode}>{children}</AnimatePresence>
        </div>
    );
};

export default AnimatePresenceWrapper; 