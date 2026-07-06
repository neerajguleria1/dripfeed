import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface WordsPullUpProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  showAsterisk?: boolean;
}

export default function WordsPullUp({ text, className = '', style, showAsterisk }: WordsPullUpProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const words = text.split(' ');

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
      style={style}
      className={`inline-flex flex-wrap ${className}`}
    >
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        const endsWithA = word.endsWith('a') || word.endsWith('A');
        return (
          <span key={i} className="word-item inline-block mr-[0.3em] relative">
            {isLast && endsWithA && showAsterisk ? (
              <>
                {word.slice(0, -1)}
                <span className="relative">
                  a
                  <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>
                </span>
              </>
            ) : (
              word
            )}
          </span>
        );
      })}
    </span>
  );
}
