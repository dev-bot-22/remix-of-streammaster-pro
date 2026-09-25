"use client";

import React, { useEffect, useState } from "react";

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  opacity: number;
  xOffset: number;
  rotation: number;
}

export const SpringPetals = () => {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // Generate 12-15 petals with random properties
    const petalCount = Math.floor(Math.random() * 4) + 12; // 12-15 petals
    const colors = ["#ffb7d5", "#ffcce5", "#ffd9cc"]; // soft pink, light blossom, very light peach
    
    const generatedPetals: Petal[] = Array.from({ length: petalCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 12 + 18, // 18-30s
      size: Math.random() * 6 + 12, // 12-18px
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.2 + 0.7, // 0.7-0.9
      xOffset: Math.random() * 100 - 50,
      rotation: Math.random() * 360,
    }));

    setPetals(generatedPetals);
  }, []);

  return (
    <>
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="petal-spring"
          style={{
            left: `${petal.left}%`,
            width: `${petal.size}px`,
            height: `${petal.size}px`,
            backgroundColor: petal.color,
            opacity: petal.opacity,
            animation: `petalDriftSpring-${petal.id} ${petal.duration}s linear infinite`,
            animationDelay: `${petal.delay}s`,
            position: "fixed",
            top: "-20px",
            pointerEvents: "none",
            zIndex: 1,
            borderRadius: "50% 0",
            transform: "rotate(-45deg)",
            boxShadow: `
              -3px 2px 0 rgba(255, 183, 213, 0.5),
              3px -2px 0 rgba(255, 152, 207, 0.5)
            `,
          }}
        />
      ))}

      <style>{`
        ${petals.map((petal) => `
          @keyframes petalDriftSpring-${petal.id} {
            0% {
              transform: translateY(-20px) translateX(0) rotate(-45deg);
              opacity: 0;
            }
            5% {
              opacity: ${petal.opacity};
            }
            95% {
              opacity: ${petal.opacity};
            }
            100% {
              transform: translateY(100vh) translateX(${petal.xOffset}px) rotate(${petal.rotation}deg);
              opacity: 0;
            }
          }
        `).join('')}
      `}</style>
    </>
  );
};
