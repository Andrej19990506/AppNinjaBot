import React from 'react';
import { AnimatePresence } from 'framer-motion';

interface AnimatePresenceWrapperProps {
    children: React.ReactNode;
}

const AnimatePresenceWrapper: React.FC<AnimatePresenceWrapperProps> = ({ children }) => {
    return <AnimatePresence mode="wait">{children}</AnimatePresence>;
};

export default AnimatePresenceWrapper; 