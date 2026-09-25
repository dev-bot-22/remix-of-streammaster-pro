import React from 'react';

interface SpringButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Spring-themed Button Component
 * Organic rounded button with spring color gradients
 */
export const SpringButton: React.FC<SpringButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
}) => {
  const baseStyles = `
    font-semibold font-poppins
    rounded-[16px]
    transition-all duration-300
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-7 py-3 text-base',
    lg: 'px-10 py-4 text-lg',
  };

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-spring-mint to-spring-leaf dark:from-spring-mint-dark dark:to-spring-leaf-dark
      text-white
      shadow-[0_4px_15px_rgba(76,175,106,0.3)] dark:shadow-[0_4px_15px_rgba(109,212,119,0.2)]
      hover:shadow-[0_8px_28px_rgba(76,175,106,0.4)] dark:hover:shadow-[0_8px_28px_rgba(109,212,119,0.3)]
      hover:scale-105 active:scale-98
    `,
    secondary: `
      bg-spring-leaf/12 dark:bg-spring-mint/10
      text-spring-leaf dark:text-spring-mint
      border border-spring-leaf/30 dark:border-spring-mint/20
      hover:bg-spring-leaf/18 dark:hover:bg-spring-mint/15
      hover:border-spring-leaf/50 dark:hover:border-spring-mint/30
      hover:shadow-[0_4px_12px_rgba(76,175,106,0.15)] dark:hover:shadow-[0_4px_12px_rgba(109,212,119,0.1)]
    `,
    accent: `
      bg-gradient-to-r from-spring-pink to-spring-pink-accent dark:from-spring-pink-dark dark:to-spring-pink-accent
      text-spring-forest dark:text-spring-cream
      shadow-[0_4px_15px_rgba(255,183,213,0.2)]
      hover:shadow-[0_8px_28px_rgba(255,183,213,0.3)]
      hover:scale-105 active:scale-98
    `,
    ghost: `
      bg-transparent
      border border-spring-leaf/20 dark:border-spring-mint/20
      text-spring-leaf dark:text-spring-mint
      hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5
      hover:border-spring-leaf/40 dark:hover:border-spring-mint/40
    `,
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default SpringButton;
