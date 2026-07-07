import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Search, Bell, Sparkles } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

function CountdownTimer() {
  const target = new Date('2026-07-16T00:00:00');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) return;
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const boxes = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-5 mt-6">
      {boxes.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl bg-white/60 backdrop-blur-sm border border-[#0F0F1A]/10 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-medium tracking-tight text-[#0F0F1A]">
              {String(value).padStart(2, '0')}
            </span>
          </div>
          <div className="text-[10px] font-mono tracking-wider text-[#0F0F1A]/25 uppercase mt-2">{label}</div>
        </div>
      ))}
    </div>
  );
}

const teasers = [
  {
    icon: Search,
    label: 'Price Compare',
    desc: 'Compare prices across Myntra, Ajio, Flipkart & more',
    bullets: ['5+ platforms indexed', 'Real-time price sync', 'Savings up to 40%'],
  },
  {
    icon: Bell,
    label: 'Smart Alerts',
    desc: 'Get notified the moment prices drop on your wishlist',
    bullets: ['Drop notifications', 'Wishlist monitoring', 'Flash sale alerts'],
  },
  {
    icon: Sparkles,
    label: 'Style Discovery',
    desc: 'Discover trending fashion from across India',
    bullets: ['Personalised picks', 'Trending daily', 'Curated collections'],
  },
];

export default function LaunchingSoon() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const countdownRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const teasersRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);

  // Mount animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from(heroRef.current, { opacity: 0, y: 40, duration: 0.8 })
      .from(badgeRef.current, { opacity: 0, duration: 0.4 }, '-=0.5')
      .from(sublineRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.3')
      .from(countdownRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.3')
      .from(dividerRef.current, { scaleX: 0, duration: 0.8, ease: 'power3.inOut' }, '-=0.2')
      .from(footerRef.current, { opacity: 0, duration: 0.6 }, '-=0.2');
  }, { scope: pageRef });

  // Teasers scroll-triggered
  useGSAP(() => {
    const teaserCards = teasersRef.current?.querySelectorAll('.teaser-card');
    if (!teaserCards?.length) return;

    gsap.from(teaserCards, {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: teasersRef.current,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: pageRef });

  return (
    <div ref={pageRef} className="text-[#0F0F1A] flex flex-col relative overflow-hidden">
      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-28 pb-16">
        <div ref={heroRef} className="max-w-4xl mx-auto text-center">
          {/* Tag */}
          <span
            ref={badgeRef}
            className="inline-block px-4 py-1.5 rounded-full border border-[#0F0F1A]/10 bg-white/60 text-[10px] font-mono tracking-[0.2em] uppercase text-[#0F0F1A]/40 mb-8"
          >
            Coming Soon
          </span>

          {/* Main headline */}
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium leading-[0.85] tracking-[-0.06em] text-[#0F0F1A]">
              Launching Before you can Expect.
            </h2>
          </div>

          {/* Sub-line */}
          <p
            ref={sublineRef}
            className="text-[#0F0F1A]/40 text-sm sm:text-base md:text-lg max-w-lg mx-auto mt-6 leading-relaxed"
          >
            Changing how India feels fashion.
          </p>

          {/* Countdown Timer */}
          <div ref={countdownRef}>
            <CountdownTimer />
          </div>

          {/* Decorative line */}
          <div
            ref={dividerRef}
            className="h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/20 to-transparent max-w-xs mx-auto mt-8"
          />
        </div>

        {/* Teasers */}
        <div
          ref={teasersRef}
          className="w-full max-w-2xl mx-auto mt-16"
        >
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/10 to-transparent mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {teasers.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.label}
                  className="teaser-card rounded-xl border border-[#0F0F1A]/10 bg-white/40 backdrop-blur-sm p-4 text-center hover:border-[#0F0F1A]/15 transition-all duration-500"
                >
                  <Icon className="w-5 h-5 text-[#0F0F1A] mx-auto mb-2" />
                  <h4 className="text-sm font-medium text-[#0F0F1A]/80 mb-1">{t.label}</h4>
                  <p className="text-xs text-[#0F0F1A]/40 mb-2.5">{t.desc}</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {t.bullets.map((b) => (
                      <span key={b} className="text-[9px] font-mono tracking-wide text-[#0F0F1A]/25 bg-white/50 border border-[#0F0F1A]/10 rounded-full px-2 py-0.5">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Small footer text */}
        <p
          ref={footerRef}
          className="text-[#0F0F1A]/15 text-xs mt-8"
        >
          Stay tuned.
        </p>
      </div>
    </div>
  );
}


