import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function FeaturesPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);

  // Mount animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from(heroRef.current, { opacity: 0, y: 30, duration: 0.6 })
      .from(badgeRef.current, { opacity: 0, duration: 0.4 }, '-=0.3')
      .from(sublineRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.2');
  }, { scope: pageRef });

  return (
    <div ref={pageRef} className="text-[#051F45]">
      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-16 pt-20 md:pt-28 pb-10 text-center">
        <div ref={heroRef} className="max-w-4xl mx-auto">
          <span
            ref={badgeRef}
            className="inline-block px-6 py-2 rounded-full border border-[#051F45]/10 bg-white/60 text-xs font-mono font-bold tracking-[0.2em] uppercase mb-6"
          >
            <span className="text-[#FF9933]">Build</span>{' '}
            <span className="text-[#051F45]">for</span>{' '}
            <span className="text-[#138808]">India</span>
          </span>
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium leading-[0.85] tracking-[-0.05em] text-[#051F45]">
              Everything you need to shop smarter.
            </h2>
          </div>
          <p ref={sublineRef} className="text-[#051F45] text-sm sm:text-base max-w-lg mx-auto mt-6">
            Smart tools designed for the Indian fashion ecosystem. Compare, track, and discover across your favourite platforms — all in one place.
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <span className="px-3 py-1 rounded-full border border-[#051F45]/10 bg-white/60 text-[10px] font-mono tracking-[0.15em] uppercase text-[#051F45]">Thrift</span>
            <span className="text-[#051F45] text-xs">+</span>
            <span className="px-3 py-1 rounded-full border border-[#051F45]/10 bg-white/60 text-[10px] font-mono tracking-[0.15em] uppercase text-[#051F45]">New</span>
          </div>
        </div>
      </section>
    </div>
  );
}
