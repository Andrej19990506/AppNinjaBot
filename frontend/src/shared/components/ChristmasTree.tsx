import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './ChristmasTree.css';

interface ChristmasTreeProps {
  onClick?: () => void;
}

const ChristmasTree: React.FC<ChristmasTreeProps> = ({ onClick }) => {
  const [isTreeTwinkling, setIsTreeTwinkling] = useState(true);

  const handleClick = () => {
    setIsTreeTwinkling(!isTreeTwinkling);
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      className={`global-christmas-tree ${isTreeTwinkling ? 'twinkle' : ''}`}
      initial={{ opacity: 0, scale: 0, rotate: -180 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: 0.5
      }}
      onClick={handleClick}
      whileHover={{ scale: 1.15, rotate: 5 }}
      whileTap={{ scale: 0.9, rotate: -5 }}
    >
      <img 
        src="/free-icon-christmas-tree-9011704.png" 
        alt="🎄" 
        draggable={false}
      />
    </motion.div>
  );
};

export default ChristmasTree;

