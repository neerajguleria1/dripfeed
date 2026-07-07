import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Search, BarChart3, Bell } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Browse Across India\'s Top Platforms',
    desc: 'Search any fashion product and instantly see prices from Myntra, Ajio, Flipkart, Nykaa Fashion, and more — all in one place.',
    highlights: ['Myntra', 'Ajio', 'Flipkart', 'Nykaa'],
    details: [
      'Unified search across 5+ major Indian fashion platforms',
      'Real-time price aggregation with platform-specific results',
      'Filter by brand, size, colour, and price range',
      'Save favourite products to personalised wishlists',
    ],
    stat: '10K+ products indexed',
  },
  {
    number: '02',
    icon: BarChart3,
    title: 'Compare Prices & Track History',
    desc: 'View interactive price charts, compare across platforms, and know exactly where to buy. No more hopping between tabs.',
    highlights: ['Price Charts', 'Cross-Compare', 'Best Deal'],
    details: [
      'Side-by-side price comparison across all platforms',
      '7-day and 30-day price history charts',
      'Lowest price identification with platform link',
      'Price trend analysis to time your purchase perfectly',
    ],
    stat: 'Average savings of 25%',
  },
  {
    number: '03',
    icon: Bell,
    title: 'Get Alerts & Never Miss a Drop',
    desc: 'Set your target price and let DripFeed watch the market. The moment your wishlist item drops, you get an instant notification.',
    highlights: ['Price Drops', 'Flash Sales', 'Instant Alerts'],
    details: [
      'Custom price thresholds for every wishlist item',
      'Instant push notifications when prices drop',
      'Flash sale alerts before popular items sell out',
      'Weekly price digest with platform-wise updates',
    ],
    stat: 'Monitor 1000s of products',
  },
];

export default function HowItWorks() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  // Mount animations for hero
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from(heroRef.current, { opacity: 0, y: 30, duration: 0.6 })
      .from(badgeRef.current, { opacity: 0, duration: 0.4 }, '-=0.3')
      .from(sublineRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.2');
  }, { scope: pageRef });

  // Scroll-triggered animations for steps
  useGSAP(() => {
    const stepCards = stepsRef.current?.querySelectorAll('.step-card');
    if (!stepCards?.length) return;

    gsap.from(stepCards, {
      opacity: 0,
      y: 60,
      stagger: 0.15,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: stepsRef.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: pageRef });

  // CTA scroll-triggered
  useGSAP(() => {
    gsap.from(ctaRef.current, {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: ctaRef.current,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: pageRef });

  return (
    <div ref={pageRef} className="text-[#0F0F1A] flex flex-col relative overflow-hidden">
      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-16 pt-28 md:pt-36 pb-10 text-center">
        <div ref={heroRef} className="max-w-4xl mx-auto">
          <span
            ref={badgeRef}
            className="inline-block px-4 py-1.5 rounded-full border border-[#0F0F1A]/10 bg-white/60 text-[10px] font-mono tracking-[0.2em] uppercase text-[#0F0F1A]/40 mb-6"
          >
            How It Works
          </span>
          <div className="text-center">
            <h2 ref={headlineRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium leading-[0.85] tracking-[-0.06em] text-[#0F0F1A]">
              Shopping, Reimagined for India.
            </h2>
          </div>
          <p
            ref={sublineRef}
            className="text-[#0F0F1A]/40 text-sm sm:text-base md:text-lg max-w-xl mx-auto mt-6 leading-relaxed"
          >
            DripFeed scans thousands of products across India's top fashion platforms so you can compare, track, and save — all from one place.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section ref={stepsRef} className="relative z-10 flex-1 px-4 sm:px-6 lg:px-16 pb-24">
        <div className="max-w-5xl mx-auto">
          {/* Timeline line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#C9A96E]/20 via-[#C9A96E]/5 to-transparent -translate-x-1/2" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={`step-card relative flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-8 md:gap-12`}
                >
                  {/* Content card */}
                  <div className="w-full lg:w-1/2 group">
                    <div className="relative rounded-2xl md:rounded-[2rem] overflow-hidden border border-[#0F0F1A]/15 hover:border-[#0F0F1A]/25 transition-all duration-500 bg-white/70 backdrop-blur-sm p-6 md:p-8">
                      {/* Top accent */}
                      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/20 to-transparent" />

                      {/* Number + Icon */}
                      <div className="flex items-center gap-4 mb-5">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/15">
                          <Icon className="w-5 h-5 text-[#0F0F1A]" />
                        </div>
                        <span className="text-[11px] font-mono tracking-widest text-[#0F0F1A]/30">
                          {step.number}
                        </span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.03em] leading-[1.1] mb-3 text-[#0F0F1A]/90">
                        {step.title}
                      </h3>
                      <p className="text-[#0F0F1A]/50 text-sm leading-relaxed mb-4">
                        {step.desc}
                      </p>

                      {/* Detail bullets */}
                      <ul className="space-y-2 mb-5">
                        {step.details.map((d) => (
                          <li key={d} className="flex items-start gap-2.5 text-[#0F0F1A]/40 text-xs">
                            <span className="w-1 h-1 rounded-full bg-[#C9A96E]/40 mt-1.5 shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>

                      {/* Bottom row: highlights + stat */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-wrap gap-2">
                          {step.highlights.map((h) => (
                            <span
                              key={h}
                              className="inline-block px-3 py-1 rounded-full bg-white/60 border border-[#0F0F1A]/10 text-[10px] font-mono tracking-wide text-[#0F0F1A]/40"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] font-mono tracking-wider text-[#0F0F1A]/30 whitespace-nowrap">
                          {step.stat}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Spacer for the other half on desktop */}
                  <div className="hidden lg:block w-1/2" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Decorative divider */}
      <div className="relative z-10 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/10 to-transparent max-w-2xl mx-auto" />

      {/* CTA */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-16 py-16 md:py-20 text-center">
        <div ref={ctaRef}>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-[-0.04em] leading-[0.9] mb-3 text-[#0F0F1A]">
            Ready to shop smarter?
          </h2>
          <p className="text-[#0F0F1A]/40 text-sm sm:text-base max-w-md mx-auto mb-8">
            Join the waitlist and be the first to experience DripFeed.
          </p>
          <button
            onClick={() => document.getElementById('early-join')?.scrollIntoView({ behavior: 'smooth' })}
            className="group inline-flex items-center gap-2 bg-[#C9A96E] text-black rounded-full px-6 py-3 font-bold text-sm transition-all duration-300 hover:gap-3 cursor-pointer"
          >
            Join the Waitlist
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}


