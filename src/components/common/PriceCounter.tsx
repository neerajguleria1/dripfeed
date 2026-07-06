import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

interface PriceCounterProps {
  value: number;
  className?: string;
}

export function PriceCounter({ value, className = '' }: PriceCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { val: 0 };

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val: value,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: () => {
          el.textContent = `₹${Math.round(obj.val).toLocaleString('en-IN')}`;
        },
      });
    }, el);

    return () => ctx.revert();
  }, [value]);

  return <span ref={ref} className={`tabular-nums ${className}`}>₹0</span>;
}
