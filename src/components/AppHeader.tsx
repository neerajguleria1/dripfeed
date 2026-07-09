import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Heart, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './common/Logo';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Hide header search on pages that have their own hero search
  const hideSearch = location.pathname === '/search' || location.pathname === '/';

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Logo variant="dark" size="md" />

        {!hideSearch && (
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search kurtas, sneakers, sarees…"
                className="w-full pl-9 pr-4 py-2 rounded-full border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/30 focus:border-[#C9A96E] placeholder:text-neutral-400 transition-all"
              />
            </div>
          </form>
        )}

        <nav className="hidden sm:flex items-center gap-3 ml-auto">
          {user ? (
            <>
              <Link to="/wishlist" className="flex items-center gap-1 text-sm text-neutral-600 hover:text-[#C9A96E] transition-colors">
                <Heart className="w-4 h-4" /> Saved
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="text-sm text-neutral-600 hover:text-[#C9A96E] transition-colors">Admin</Link>
              )}
              <button onClick={logout} className="flex items-center gap-1 text-sm text-neutral-600 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="bg-[#C9A96E] text-white text-sm px-5 py-2.5 rounded-full hover:bg-[#B8964F] transition-colors font-semibold min-h-[44px] flex items-center">
                Sign In
              </Link>
            </>
          )}
        </nav>

        <button className="sm:hidden ml-auto text-[#0F0F1A] min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden border-t border-neutral-100 px-4 py-3 flex flex-col gap-3 bg-white/95 backdrop-blur-sm">
          {!hideSearch && (
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-full border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/30 min-h-[44px]"
                />
              </div>
            </form>
          )}
          {user ? (
            <div className="flex gap-4 text-sm text-[#0F0F1A]">
              <Link to="/wishlist" onClick={() => setMenuOpen(false)} className="min-h-[44px] flex items-center">Saved</Link>
              {user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)} className="min-h-[44px] flex items-center">Admin</Link>}
              <button onClick={() => { logout(); setMenuOpen(false); }} className="min-h-[44px] flex items-center text-red-500">Logout</button>
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="bg-[#C9A96E] text-white px-5 py-2.5 rounded-full font-medium min-h-[44px] flex items-center">Sign In</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
