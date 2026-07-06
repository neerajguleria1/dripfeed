import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface Segment {
  text: string;
  className: string;
}

interface WordsPullUpMultiStyleProps {
  segments: Segment[];
  className?: string;
}

export default function WordsPullUpMultiStyle({ segments, className = '' }: WordsPullUpMultiStyleProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  const wordEntries: { word: string; className: string }[] = [];
  segments.forEach((seg) => {
    const words = seg.text.split(' ');
    words.forEach((w) => {
      if (w.length > 0) wordEntries.push({ word: w, className: seg.className });
    });
  });

  useGSAP(() => {
    const wordElements = containerRef.current?.querySelectorAll('.word-item');
    if (!wordElements?.length) return;

    gsap.from(wordElements, {
      opacity: 0,
      y: 20,
      stagger: 0.06,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: containerRef });

  return (
    <span
      ref={containerRef}
      className={`inline-flex flex-wrap justify-center ${className}`}
    >
      {wordEntries.map((entry, i) => (
        <span
          key={i}
          className={`word-item inline-block mr-[0.3em] ${entry.className}`}
        >
          {entry.word}
        </span>
      ))}
    </span>
  );
}
