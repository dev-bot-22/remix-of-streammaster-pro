import React from 'react';

interface SpringInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Spring-themed Input Field Component
 * Rounded field with soft inner shadows and glow focus effect
 */
export const SpringInput = React.forwardRef<HTMLInputElement, SpringInputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-spring-forest dark:text-spring-cream mb-2 font-poppins">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full
            rounded-[14px]
            bg-white/80 dark:bg-spring-forest/60
            backdrop-blur-[8px]
            border-[1.5px] border-spring-leaf/15 dark:border-spring-mint/20
            px-4 py-3
            text-spring-forest dark:text-spring-cream
            placeholder:text-spring-forest/40 dark:placeholder:text-spring-cream/40
            focus:outline-none
            focus:border-spring-leaf dark:focus:border-spring-mint
            focus:shadow-[0_0_0_3px_rgba(76,175,106,0.15)] dark:focus:shadow-[0_0_0_3px_rgba(109,212,119,0.2)]
            focus:bg-white/95 dark:focus:bg-spring-forest/80
            transition-all duration-300
            font-inter font-normal
            ${error ? 'border-red-500 dark:border-red-400' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-spring-forest/60 dark:text-spring-cream/60 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

SpringInput.displayName = 'SpringInput';

export default SpringInput;
