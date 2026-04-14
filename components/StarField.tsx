"use client";

import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

/**
 * CSS-animated star field. Generated client-side after mount to avoid
 * SSR/hydration mismatches from Math.random().
 */
export default function StarField() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const generated: Star[] = Array.from({ length: 150 }, (_, i) => {
      const rand = Math.random();
      // Size distribution: mostly tiny, a few medium, rare large
      const size =
        rand < 0.62 ? 0.8 : rand < 0.88 ? 1.4 : rand < 0.97 ? 2 : 3;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        delay: Math.random() * 9,
        duration: Math.random() * 4 + 3,
        opacity: Math.random() * 0.55 + 0.08,
      };
    });
    setStars(generated);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: `twinkle ${star.duration}s ${star.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
