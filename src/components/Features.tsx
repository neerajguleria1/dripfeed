import { useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Check } from 'lucide-react';
import WordsPullUpMultiStyle from './WordsPullUpMultiStyle';

gsap.registerPlugin(ScrollTrigger);

interface FeatureCardProps {
  index: number;
  children: React.ReactNode;
}

function FeatureCard({ index, children }: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(cardRef.current, {
      rotateY: x * 12,
      rotateX: -y * 12,
      duration: 0.4,
      ease: 'power2.out',
      transformPerspective: 600,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    gsap.to(cardRef.current, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.6)',
    });
  }, []);

  useGSAP(() => {
    gsap.from(cardRef.current, {
      opacity: 0,
      y: 30,
      duration: 0.5,
      ease: 'power3.out',
      delay: index * 0.15,
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: cardRef, dependencies: [index] });

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group rounded-2xl md:rounded-[2rem] overflow-hidden border border-[#0F0F1A]/10 hover:border-[#0F0F1A]/15 transition-[border-color] duration-500"
      style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      {children}
    </div>
  );
}

interface ChecklistCardProps {
  title: string;
  number: string;
  iconUrl: string;
  items: string[];
}

function ChecklistCard({ title, number, iconUrl, items }: ChecklistCardProps) {
  return (
    <div className="bg-white/40 backdrop-blur-sm border border-[#0F0F1A]/10 h-full p-5 md:p-6 flex flex-col relative overflow-hidden rounded-2xl md:rounded-[2rem]">
      {/* Subtle top accent */}
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/20 to-transparent" />

      {/* Icon with ring */}
      <div className="relative mb-4" style={{ transform: 'translateZ(20px)' }}>
        <div className="absolute inset-0 rounded-full bg-[#C9A96E]/5 blur-sm" />
        <img
          src={iconUrl}
          alt=""
          className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-full border border-[#0F0F1A]/10 object-cover"
        />
      </div>

      {/* Title + Number */}
      <div className="flex items-baseline justify-between gap-2 mb-3" style={{ transform: 'translateZ(15px)' }}>
        <h3 className="text-base font-semibold text-[#0F0F1A]">{title}</h3>
        <span className="shrink-0 text-[10px] font-mono text-[#0F0F1A]/15 tracking-wider">{number}</span>
      </div>

      {/* List */}
      <ul className="space-y-2.5 flex-1" style={{ transform: 'translateZ(10px)' }}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[#0F0F1A] text-xs sm:text-sm leading-relaxed">
            <span className="flex items-center justify-center w-4 h-4 mt-0.5 shrink-0 rounded-full bg-[#C9A96E]/10">
              <Check className="w-2.5 h-2.5 text-[#0F0F1A]" />
            </span>
            <span className="text-[#0F0F1A] group-hover:text-[#0F0F1A] transition-colors duration-300">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Features() {
  return (
    <section className="min-h-screen relative px-4 py-16 md:py-24">
      {/* Noise overlay */}
      <div className="bg-noise" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <WordsPullUpMultiStyle
            segments={[
              { text: 'Smart shopping tools for the style-conscious Indian shopper.', className: '' },
              { text: 'Compare. Track. Save. Simplified.', className: 'text-[#0F0F1A]' },
            ]}
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal"
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-2 md:gap-1 lg:h-[480px]" style={{ perspective: '1000px' }}>
          {/* Card 1 — Video */}
          <FeatureCard index={0}>
            <div className="relative h-full min-h-[200px] lg:min-h-0 bg-[#0F0F1A]/10 overflow-hidden group/video">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover object-left transition-transform duration-700 group-hover/video:scale-105"
              >
                <source
                  src="https://videos.pexels.com/video-files/8308005/8308005-uhd_2732_1440_25fps.mp4"
                  type="video/mp4"
                />
              </video>
              {/* Layered gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

              {/* Badge */}
              <div className="absolute bottom-4 left-4 z-10" style={{ transform: 'translateZ(30px)' }}>
                <span className="inline-block px-3 py-1 rounded-full bg-black/10 backdrop-blur-md border border-white/10 text-[10px] font-medium text-[#0F0F1A] tracking-wide uppercase">
                  Price Tracker
                </span>
                <p className="text-xs text-[#0F0F1A] mt-1.5 ml-0.5">Your personal price tracker.</p>
              </div>
            </div>
          </FeatureCard>

          {/* Card 2 — Project Storyboard */}
          <FeatureCard index={1}>
            <ChecklistCard
              title="Price Compare."
              number="01"
              iconUrl="https://images.pexels.com/photos/12911845/pexels-photo-12911845.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
              items={[
                'Compare across Myntra, Ajio & Flipkart',
                'View interactive price history charts',
                'Find the best deal with one tap',
                'Save up to 40% on every purchase',
              ]}
            />
          </FeatureCard>

          {/* Card 3 — Smart Critiques */}
          <FeatureCard index={2}>
            <ChecklistCard
              title="Smart Alerts."
              number="02"
              iconUrl="https://images.pexels.com/photos/7283499/pexels-photo-7283499.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
              items={[
                'Real-time price drop notifications',
                'Wishlist monitoring across 5 platforms',
                'Flash sale alerts before they sell out',
                'Custom price targets for every item',
              ]}
            />
          </FeatureCard>

          {/* Card 4 — Immersion Capsule */}
          <FeatureCard index={3}>
            <ChecklistCard
              title="Style Discovery."
              number="03"
              iconUrl="https://images.pexels.com/photos/30195487/pexels-photo-30195487.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
              items={[
                'Personalised picks based on your taste',
                'Trending products from across India',
                'Explore 1000s of brands effortlessly',
                'Save looks and build your wardrobe',
              ]}
            />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}


