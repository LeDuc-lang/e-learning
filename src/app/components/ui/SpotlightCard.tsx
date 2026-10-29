'use client';

import React, { useRef } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',

  spotlightColor = 'rgba(116, 161, 142, 0.12)',
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      style={{ '--spotlight-color': spotlightColor } as React.CSSProperties}
      className={`group relative overflow-hidden rounded-2xl bg-[#FAF9F6] border border-gray-200/80 transition-all duration-300 hover:border-[#74A18E]/60 hover:shadow-sm motion-safe:hover:-translate-y-0.5 ${className}`}
      {...props}
    >

      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100"
        style={{
          background: `radial-gradient(450px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), var(--spotlight-color), transparent 80%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};