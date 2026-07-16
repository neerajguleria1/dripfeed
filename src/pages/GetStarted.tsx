import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const benefits = [
  {
    title: 'Price Comparison',
    emoji: '\uD83D\uDD0D',
    count: '5+ platforms',
    images: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&fit=crop',
    ],
  },
  {
    title: 'Smart Alerts',
    emoji: '\uD83D\uDD14',
    count: 'Real-time',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&q=80&fit=crop',
    ],
  },
  {
    title: 'Trend Discovery',
    emoji: '\u2728',
    count: 'Daily picks',
    images: [
      'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400&h=400&q=80&fit=crop',
    ],
  },
  {
    title: 'Always Free',
    emoji: '\uD83D\uDE0D',
    count: 'No hidden fees',
    images: [
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&q=80&fit=crop',
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&q=80&fit=crop',
    ],
  },
];

export default function GetStarted() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);

  // Mount animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from(heroRef.current, { opacity: 0, y: 30, duration: 0.6 })
      .from(badgeRef.current, { opacity: 0, duration: 0.4 }, '-=0.3')
      .from(sublineRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.2')
      .from(benefitsRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.3')
      .from(ctasRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.3');
  }, { scope: pageRef });

  return (
    <div ref={pageRef} className="text-[#0F0F1A] flex flex-col relative overflow-hidden">
      {/* Main Content Centered */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-4xl">
          {/* Hero */}
          <div ref={heroRef} className="text-center mb-12">
            <span
              ref={badgeRef}
              className="inline-block px-4 py-1.5 rounded-full border border-[#0F0F1A]/10 bg-white/60 text-[10px] font-mono tracking-[0.2em] uppercase text-[#0F0F1A]/40 mb-6"
            >
              TagCheck
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium leading-[0.85] tracking-[-0.06em] text-center text-[#0F0F1A]">
              Your Fashion Companion Awaits.
            </h2>
            <p
              ref={sublineRef}
              className="text-[#0F0F1A]/40 text-sm sm:text-base md:text-lg max-w-lg mx-auto mt-6 leading-relaxed"
            >
              Compare prices, track drops, and discover trends across India's top fashion platforms — all in one place. Free forever.
            </p>
          </div>

          {/* Benefits — overlapping collection cards */}
          <div
            ref={benefitsRef}
            className="flex justify-center gap-0 mb-10 max-w-5xl mx-auto px-4"
          >
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className={`group relative bg-white rounded-3xl p-3 pb-4 w-56 shrink-0 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-[#0F0F1A]/10 ${i > 0 ? '-ml-10' : ''}`}
                style={{ zIndex: i }}
              >
                {/* 2x2 Photo Grid */}
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden mb-3">
                  {b.images.map((img, j) => (
                    <img
                      key={j}
                      src={img}
                      alt=""
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
                {/* Title + Count */}
                <div className="px-1">
                  <span className="text-sm font-bold text-[#0F0F1A]">{b.title}</span>
                  <span className="ml-1">{b.emoji}</span>
                  <p className="text-[10px] text-[#0F0F1A]/40 mt-0.5">{b.count}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            ref={ctasRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => document.getElementById('early-join')?.scrollIntoView({ behavior: 'smooth' })}
              className="group inline-flex items-center gap-2 bg-[#C9A96E] text-black rounded-full px-6 py-3 font-medium text-sm transition-all duration-300 hover:gap-3 cursor-pointer"
            >
              Join the Waitlist
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/how-it-works')}
              className="inline-flex items-center gap-2 border border-[#0F0F1A]/20 text-[#0F0F1A]/80 rounded-full px-6 py-3 font-medium text-sm hover:bg-white/60 transition-colors cursor-pointer"
            >
              See How It Works
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


