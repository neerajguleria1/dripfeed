import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const trendingSearches = ['Nike Air Force 1', 'Kurta Set', 'Denim Jacket', 'White Sneakers', 'Saree Under 2000', 'Cargo Pants'];

export default function Hero() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(contentRef.current?.children || [], {
      y: 30,
      opacity: 0,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power2.out',
      delay: 0.2,
    });
  }, { scope: sectionRef });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/compare?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleTrendingClick(term: string) {
    navigate(`/compare?q=${encodeURIComponent(term)}`);
  }

  return (
    <section ref={sectionRef} className="min-h-[85vh] relative overflow-hidden flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F8F5F2] via-[#FDF5F7] to-[#F8F5F2]" />

      {/* Content */}
      <div ref={contentRef} className="relative z-10 w-full max-w-3xl mx-auto px-4 py-16 text-center">
        {/* Logo + Tagline */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-[#0F0F1A]/60" />
          <span className="text-xs font-medium text-[#0F0F1A]/60 uppercase tracking-widest">AI Shopping Assistant</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#0F0F1A] mb-4" style={{ fontFamily: "'Lobster Two', cursive" }}>
          TagCheck
        </h1>

        <p className="text-[#0F0F1A]/70 text-base sm:text-lg mb-8 max-w-lg mx-auto">
          Search any product. Compare prices across Ajio, Amazon, Flipkart & more. Get AI recommendations on whether to buy now or wait.
        </p>

        {/* Main Search Bar */}
        <form onSubmit={handleSearch} className="relative max-w-xl mx-auto mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F1A]/40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search any product... Nike, Kurta, Denim Jacket"
            className="w-full pl-14 pr-32 py-4 sm:py-5 rounded-full border-2 border-[#0F0F1A]/10 bg-white shadow-lg shadow-[#0F0F1A]/5 text-base focus:outline-none focus:border-[#0F0F1A]/30 focus:shadow-xl transition-all placeholder:text-[#0F0F1A]/35"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0F0F1A] text-white px-5 py-2.5 sm:py-3 rounded-full text-sm font-semibold hover:bg-[#0F0F1A]/90 transition-colors flex items-center gap-1.5"
          >
            <span>Compare</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Trending searches */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-[#0F0F1A]/40">Trending:</span>
          {trendingSearches.map(term => (
            <button
              key={term}
              onClick={() => handleTrendingClick(term)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/80 border border-[#0F0F1A]/10 text-[#0F0F1A]/70 hover:bg-[#0F0F1A] hover:text-white transition-all"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-[#0F0F1A]/5">
            <p className="text-2xl mb-1">🔍</p>
            <p className="font-semibold text-sm text-[#0F0F1A]">Compare Prices</p>
            <p className="text-xs text-[#0F0F1A]/50 mt-0.5">Across 3+ platforms instantly</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-[#0F0F1A]/5">
            <p className="text-2xl mb-1">🤖</p>
            <p className="font-semibold text-sm text-[#0F0F1A]">AI Advice</p>
            <p className="text-xs text-[#0F0F1A]/50 mt-0.5">Buy now or wait? AI tells you</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-[#0F0F1A]/5">
            <p className="text-2xl mb-1">💰</p>
            <p className="font-semibold text-sm text-[#0F0F1A]">Save Money</p>
            <p className="text-xs text-[#0F0F1A]/50 mt-0.5">Average savings ₹500+ per purchase</p>
          </div>
        </div>
      </div>
    </section>
  );
}

