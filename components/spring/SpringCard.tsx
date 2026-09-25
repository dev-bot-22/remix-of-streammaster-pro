import React from 'react';

interface SpringCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

/**
 * Spring-themed Card Component
 * Soft garden tile with glass morphism effect
 */
export const SpringCard: React.FC<SpringCardProps> = ({
  children,
  className = '',
  hover = true,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white/90 dark:bg-spring-forest-surface/80
        backdrop-blur-[10px]
        rounded-[18px]
        border border-spring-leaf/15 dark:border-spring-mint/20
        shadow-spring-md dark:shadow-spring-md
        ${hover ? 'hover:shadow-spring-xl Dark:hover:shadow-spring-lg hover:border-spring-leaf/25 dark:hover:border-spring-mint/30 hover:-translate-y-2 transition-all duration-300 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default SpringCard;
