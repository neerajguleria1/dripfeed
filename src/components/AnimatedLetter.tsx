import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface AnimatedLetterProps {
  text: string;
  className?: string;
}

export default function AnimatedLetter({ text, className = '' }: AnimatedLetterProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    // Scroll-linked opacity: fades in from 0.15 to 1 as element enters viewport
    gsap.fromTo(ref.current,
      { opacity: 0.15 },
      {
        opacity: 1,
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          end: 'top 20%',
          scrub: true,
        },
      }
    );
  }, { scope: ref });

  return (
    <p
      ref={ref}
      className={`${className} break-words`}
    >
      {text}
    </p>
  );
}
