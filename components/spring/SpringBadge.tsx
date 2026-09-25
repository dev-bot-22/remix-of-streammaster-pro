import React from 'react';

interface SpringBadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'alert' | 'premium' | 'info';
  className?: string;
}

/**
 * Spring-themed Badge Component
 * Colored badges for status, categories, and highlights
 */
export const SpringBadge: React.FC<SpringBadgeProps> = ({
  children,
  variant = 'success',
  className = '',
}) => {
  const variantStyles = {
    success: `
      bg-spring-leaf/15 dark:bg-spring-leaf-dark/15
      text-spring-leaf dark:text-spring-mint
    `,
    alert: `
      bg-spring-yellow-accent/15 dark:bg-spring-yellow-accent/15
      text-spring-yellow-accent dark:text-spring-yellow-accent
    `,
    premium: `
      bg-spring-lavender/15 dark:bg-spring-lavender-dark/15
      text-spring-lavender dark:text-spring-lavender-dark
    `,
    info: `
      bg-spring-sky/15 dark:bg-spring-sky-dark/15
      text-spring-sky dark:text-spring-sky-dark
    `,
  };

  return (
    <span
      className={`
        inline-block
        px-3 py-1
        rounded-lg
        text-xs font-semibold
        font-poppins
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default SpringBadge;
