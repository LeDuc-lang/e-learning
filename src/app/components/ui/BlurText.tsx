'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface BlurTextProps {
  text: string;
  className?: string;
  delayStep?: number;
}

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const BlurText: React.FC<BlurTextProps> = ({
  text,
  className = '',
  delayStep = 60,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => false
  );
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const words = text.split(' ');

  if (reducedMotion) {
    return <h1 className={className}>{text}</h1>;
  }

  return (
    <h1 ref={containerRef} className={`flex flex-wrap ${className}`} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{ transitionDelay: `${index * delayStep}ms` }}
          className={`inline-block mr-[0.28em] transition-all duration-700 ease-out will-change-[transform,opacity,filter] ${
            isVisible
              ? 'opacity-100 blur-0 translate-y-0'
              : 'opacity-0 blur-[6px] translate-y-2'
          }`}
        >
          {word}
        </span>
      ))}
    </h1>
  );
};