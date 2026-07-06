import { useEffect, useRef } from 'react';

export default function LiquidCursor() {
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef({ x: 0, y: 0 });
  const trail = useRef(Array.from({ length: 5 }, () => ({ x: 0, y: 0 })));

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const move = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', move);

    let raf: number;
    const animate = () => {
      let x = pos.current.x;
      let y = pos.current.y;
      trail.current.forEach((p, i) => {
        p.x += (x - p.x) * 0.25;
        p.y += (y - p.y) * 0.25;
        x = p.x; y = p.y;
        const el = dotsRef.current[i];
        if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] hidden md:block">
      <svg className="absolute w-0 h-0">
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
        </filter>
      </svg>
      <div style={{ filter: 'url(#goo)' }} className="absolute inset-0">
        {trail.current.map((_, i) => (
          <div
            key={i}
            ref={(el) => { dotsRef.current[i] = el; }}
            className="absolute top-0 left-0 rounded-full"
            style={{
              width: 18 - i * 2,
              height: 18 - i * 2,
              marginTop: -(18 - i * 2) / 2,
              marginLeft: -(18 - i * 2) / 2,
              background: 'radial-gradient(circle at 30% 30%, rgba(201,169,110,0.6), rgba(26,26,46,0.3))',
              mixBlendMode: 'multiply',
            }}
          />
        ))}
      </div>
    </div>
  );
}
