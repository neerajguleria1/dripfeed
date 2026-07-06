import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'How it works', path: '/how-it-works' },
  { label: 'Features', path: '/search' },
  { label: 'Early Join', path: '/signup' },
];

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useGSAP(() => {
    gsap.from(navRef.current, {
      filter: 'blur(10px)',
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.1,
    });
  }, { scope: navRef });

  const handleNav = (item: typeof navItems[0]) => {
    if (item.path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(item.path);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 lg:px-16 pt-3 sm:pt-4"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
        {/* Logo */}
        <button onClick={() => navigate('/')} className="text-[#051F45] font-bold text-lg font-['Electrolize'] whitespace-nowrap">
          DripFeed
        </button>

        {/* Center nav links - hidden on mobile */}
        <div
          className={`hidden md:flex items-center liquid-glass rounded-full transition-all duration-300 ease-out ${
            scrolled ? 'gap-1 px-1.5 py-1' : 'gap-1.5 px-1.5 py-1.5'
          }`}
        >
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className={`whitespace-nowrap px-3 py-2 font-medium font-['Electrolize'] transition-all duration-300 ease-out no-underline cursor-pointer ${
                scrolled ? 'text-xs' : 'text-sm'
              } text-[#051F45] hover:text-[#051F45]`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side: Search + Login */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#051F45]/40" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className={`pl-8 pr-3 rounded-full border border-[#051F45]/15 bg-white/55 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#051F45]/20 placeholder:text-[#051F45]/40 transition-all ${
                scrolled ? 'py-1.5 text-xs w-36' : 'py-2 text-sm w-44'
              }`}
            />
          </form>

          {/* Mobile search icon */}
          <button
            onClick={() => navigate('/search')}
            className="sm:hidden p-2 rounded-full bg-white/55 backdrop-blur-sm border border-[#051F45]/15"
          >
            <Search className="w-4 h-4 text-[#051F45]" />
          </button>

          {/* Login button */}
          <button
            onClick={() => navigate('/login')}
            className={`flex items-center gap-1.5 rounded-full bg-[#051F45] text-white font-medium font-['Electrolize'] transition-all ${
              scrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
