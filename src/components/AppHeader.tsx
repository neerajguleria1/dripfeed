import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 liquid-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link to="/" className="flex-shrink-0 font-bold text-xl tracking-tight whitespace-nowrap overflow-hidden" style={{ fontFamily: 'Instrument Serif, serif' }}>
          <span className="text-[#051F45]">Drip</span><span style={{ color: '#F2C4CD' }}>Feed</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#051F45]/40" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search kurtas, sneakers, sarees…"
              className="w-full pl-9 pr-4 py-2 rounded-full border border-[#051F45]/15 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#051F45]/20 placeholder:text-[#051F45]/40"
            />
          </div>
        </form>

        <nav className="hidden sm:flex items-center gap-3 ml-auto">
          {user ? (
            <>
              <Link to="/wishlist" className="flex items-center gap-1 text-sm text-[#051F45]/70 hover:text-[#051F45]">
                <Heart className="w-4 h-4" /> Saved
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="text-sm text-[#051F45]/70 hover:text-[#051F45]">Admin</Link>
              )}
              <button onClick={logout} className="flex items-center gap-1 text-sm text-[#051F45]/70 hover:text-[#051F45]">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-[#051F45]/70 hover:text-[#051F45]">Login</Link>
              <Link to="/register" className="bg-[#051F45] text-white text-sm px-4 py-2 rounded-full hover:bg-[#051F45]/90 transition-colors">
                Sign Up
              </Link>
            </>
          )}
        </nav>

        <button className="sm:hidden ml-auto text-[#051F45]" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden border-t border-[#051F45]/10 px-4 py-3 flex flex-col gap-3 bg-white/80 backdrop-blur-sm">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#051F45]/40" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-9 pr-4 py-2 rounded-full border border-[#051F45]/15 bg-white/60 text-sm focus:outline-none"
              />
            </div>
          </form>
          {user ? (
            <div className="flex gap-4 text-sm text-[#051F45]">
              <Link to="/wishlist" onClick={() => setMenuOpen(false)}>Saved</Link>
              {user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
              <button onClick={() => { logout(); setMenuOpen(false); }}>Logout</button>
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="text-[#051F45]">Login</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="text-[#051F45] font-semibold">Sign Up</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
