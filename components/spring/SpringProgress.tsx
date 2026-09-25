import React from 'react';

interface SpringProgressProps {
  value: number;
  max?: number;
  label?: string;
  animated?: boolean;
}

/**
 * Spring-themed Progress Bar Component
 * With growth animation and gradient fill
 */
export const SpringProgress: React.FC<SpringProgressProps> = ({
  value,
  max = 100,
  label,
  animated = true,
}) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-spring-forest dark:text-spring-cream font-poppins">
            {label}
          </span>
          <span className="text-xs font-medium text-spring-leaf dark:text-spring-mint">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-spring-leaf/10 dark:bg-spring-mint/10 rounded-xl overflow-hidden shadow-spring-sm">
        <div
          className={`
            h-full bg-gradient-to-r from-spring-leaf to-spring-mint
            dark:from-spring-leaf-dark dark:to-spring-mint-dark
            rounded-xl
            shadow-[0_2px_8px_rgba(76,175,106,0.2)]
            ${animated ? 'transition-all duration-800 ease-out' : ''}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default SpringProgress;
