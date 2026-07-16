import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const segments = [
  { text: 'Meet TagCheck', className: '' },
  { text: 'your intelligent shopping companion.', className: 'font-serif italic' },
  { text: 'We compare prices, track drops, and find the best deals across India\'s top fashion brands.', className: '' },
];

const wordEntries: { word: string; className: string }[] = [];
segments.forEach((seg) => {
  seg.text.split(' ').forEach((w) => {
    if (w.length > 0) wordEntries.push({ word: w, className: seg.className });
  });
});

export default function About() {
  const ref = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();

  useGSAP(() => {
    // Scroll-linked opacity for heading block
    gsap.fromTo(headingRef.current,
      { opacity: 0.1 },
      {
        opacity: 1,
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          end: 'top 35%',
          scrub: true,
        },
      }
    );
  }, { scope: ref });

  return (
    <section className="px-4 py-16 md:py-24">
      <div ref={ref} className="rounded-2xl md:rounded-[2rem] p-8 md:p-16 max-w-6xl mx-auto text-center border border-[#0F0F1A]/10 bg-white/40 backdrop-blur-sm">
        <h2
          ref={headingRef}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-5xl mx-auto leading-[0.95] sm:leading-[0.9] text-[#0F0F1A]"
        >
          <span className="inline">Meet TagCheck</span>
          <br />
          <span className="inline font-serif italic text-lg sm:text-xl md:text-2xl lg:text-3xl">your intelligent shopping companion.</span>
          <br />
          <span className="inline text-sm sm:text-base md:text-lg lg:text-xl">We compare prices, track drops, and find the best deals across India's top fashion brands.</span>
        </h2>
      </div>

      {/* Explore Categories */}
      <div className="max-w-6xl mx-auto mt-20">
        <div className="text-center mb-10">
          <span className="text-[#0F0F1A] text-[10px] font-mono tracking-[0.2em] uppercase">Browse By</span>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-[-0.03em] text-[#0F0F1A] mt-2">Explore Categories</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 auto-rows-[180px] md:auto-rows-[200px]">
          {[
            { name: 'Thrift', image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=800&q=80&fit=crop', class: 'row-span-2', font: 'text-3xl md:text-5xl font-bold lowercase' },
            { name: 'Sneakers', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-bold lowercase' },
            { name: 'Denim', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-bold uppercase tracking-widest' },
            { name: 'Jackets', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&q=80&fit=crop', class: 'row-span-2', font: 'text-3xl md:text-5xl font-bold uppercase tracking-widest' },
            { name: 'Sarees', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-serif italic' },
            { name: 'Streetwear', image: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=600&h=600&q=80&fit=crop', class: '', font: 'text-xl md:text-3xl font-bold uppercase tracking-widest' },
            { name: 'Jeans', image: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-bold uppercase tracking-widest' },
            { name: 'Ethnic', image: '/categories/ethnic.webp', class: '', font: 'text-2xl md:text-4xl font-serif italic' },
            { name: 'Watches', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&h=800&q=80&fit=crop', class: 'row-span-2', font: 'text-3xl md:text-5xl font-bold uppercase tracking-widest' },
            { name: 'Bags', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-bold lowercase' },
            { name: 'Kurtas', image: '/categories/kurtas.webp', class: '', font: 'text-2xl md:text-4xl font-serif italic' },
            { name: 'Formal', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&h=600&q=80&fit=crop', class: '', font: 'text-2xl md:text-4xl font-bold uppercase tracking-widest' },
          ].map((cat) => (
            <div
              key={cat.name}
              className={`group relative rounded-xl md:rounded-2xl overflow-hidden cursor-pointer border border-[#0F0F1A]/10 ${cat.class}`}
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-500" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <span className={`text-white text-center drop-shadow-lg ${cat.font}`}>{cat.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* For Brands */}
      <div className="max-w-6xl mx-auto mt-16">
        <div className="rounded-2xl md:rounded-[2rem] overflow-hidden border border-[#0F0F1A]/10 bg-white/40 backdrop-blur-sm grid grid-cols-1 md:grid-cols-2 min-h-[400px]">
          {/* Image */}
          <div className="relative h-64 md:h-auto">
            <img
              src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1000&q=80&fit=crop"
              alt="For Brands"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          {/* Content */}
          <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16">
            <span className="text-[#0F0F1A] text-xs font-mono font-bold tracking-[0.2em] uppercase mb-4">For Brands</span>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-[1.1] tracking-[-0.02em] text-[#0F0F1A] mb-4">
              Reach shoppers at the moment of purchase intent
            </h3>
            <p className="text-[#0F0F1A] text-sm sm:text-base leading-relaxed mb-8 max-w-md">
              Put your products where shoppers are actively searching — in trending feeds, exclusive deals, and curated collections that convert.
            </p>
            <button
              onClick={() => navigate('/brands')}
              className="inline-flex items-center gap-2 text-[#0F0F1A] text-sm font-medium border-b border-[#0F0F1A]/30 pb-0.5 w-fit hover:border-[#0F0F1A]/60 transition-colors cursor-pointer"
            >
              Learn more
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Save Your Favorite Finds */}
      <div className="max-w-7xl mx-auto mt-24 px-4">
        <div className="text-center mb-16">
          <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] tracking-[-0.04em] text-[#0F0F1A] mb-6 leading-[0.9]">
            Save your <span className="font-serif italic">favorite</span> finds.
          </h2>
          <p className="text-black text-sm sm:text-base max-w-lg mx-auto">
            Save what you love. Know when prices drop.
          </p>
        </div>

        <div className="flex gap-0 overflow-x-auto pb-8 pt-8 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
          {/* Fall faves */}
          <div className="snap-center shrink-0 w-[280px] sm:w-[320px] -mr-12">
            <div className="bg-white rounded-3xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rotate-[-3deg] hover:rotate-0 transition-transform duration-300 translate-y-2">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <img src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
              </div>
              <div className="px-2 pb-1">
                <p className="text-[#0F0F1A] font-semibold text-sm">Fall faves 🍂</p>
                <p className="text-[#0F0F1A]/40 text-xs">44 items</p>
              </div>
            </div>
          </div>

          {/* Winter layers */}
          <div className="snap-center shrink-0 w-[280px] sm:w-[320px] -mr-12">
            <div className="bg-white rounded-3xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rotate-[2deg] hover:rotate-0 transition-transform duration-300 -translate-y-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <img src="https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1544441893-675973e31985?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
              </div>
              <div className="px-2 pb-1">
                <p className="text-[#0F0F1A] font-semibold text-sm">Winter layers ❄️</p>
                <p className="text-[#0F0F1A]/40 text-xs">23 items</p>
              </div>
            </div>
          </div>

          {/* Holiday wishlist */}
          <div className="snap-center shrink-0 w-[280px] sm:w-[320px] -mr-12">
            <div className="bg-white rounded-3xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rotate-[-1.5deg] hover:rotate-0 transition-transform duration-300 translate-y-5">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
              </div>
              <div className="px-2 pb-1">
                <p className="text-[#0F0F1A] font-semibold text-sm">Holiday wishlist 🎄</p>
                <p className="text-[#0F0F1A]/40 text-xs">104 items</p>
              </div>
            </div>
          </div>

          {/* Going out */}
          <div className="snap-center shrink-0 w-[280px] sm:w-[320px]">
            <div className="bg-white rounded-3xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rotate-[2.5deg] hover:rotate-0 transition-transform duration-300 -translate-y-1">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
                <img src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=400&q=80&fit=crop&sat=-100" alt="" className="w-full aspect-square object-cover rounded-2xl" />
              </div>
              <div className="px-2 pb-1">
                <p className="text-[#0F0F1A] font-semibold text-sm">Going out ✨</p>
                <p className="text-[#0F0F1A]/40 text-xs">96 items</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

