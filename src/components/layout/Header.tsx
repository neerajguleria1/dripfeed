import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Heart, User, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const navLinks = [
  { path: '/search', label: 'Search' },
  { path: '/deals', label: 'Deals' },
  { path: '/categories', label: 'Categories' },
  { path: '/thrift', label: 'Thrift' },
];

export interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  }

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 bg-white shadow-sm z-[100]',
        isDesktop ? 'h-16' : 'h-14',
        className,
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex-shrink-0 font-bold text-xl text-primary tracking-tight"
          style={{ fontFamily: 'Instrument Serif, serif' }}
        >
          Drip<span className="text-accent">Feed</span>
          <span className="text-accent text-2xl leading-none">.</span>
        </Link>

        {/* Center: Desktop Navigation */}
        {isDesktop && (
          <nav className="flex-1 flex items-center justify-center gap-6">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={[
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-gray-500 hover:text-primary',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Search icon (mobile) / Search bar (desktop) */}
          {isDesktop ? (
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#C9A96E] transition-colors" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search kurtas, sneakers…"
                className="pl-9 pr-4 py-2 w-52 rounded-full border border-neutral-200 bg-white text-sm text-[#0F0F1A] focus:outline-none focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/15 placeholder:text-neutral-400 transition-all"
              />
            </form>
          ) : (
            <button
              onClick={() => navigate('/search')}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {/* Wishlist */}
          {isDesktop && (
            <Link
              to="/wishlist"
              className="p-2 text-gray-600 hover:text-primary transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
            </Link>
          )}

          {/* User / Login */}
          {isDesktop && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-white rounded-full hover:opacity-90 transition-opacity"
                >
                  <User className="w-4 h-4" />
                  Login
                </Link>
              )}
            </>
          )}

          {/* Mobile: Hamburger */}
          {!isDesktop && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {!isDesktop && mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-md px-4 py-4 flex flex-col gap-3 z-[100]">
          {/* Mobile search */}
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-neutral-200 bg-white text-sm text-[#0F0F1A] focus:outline-none focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/15 placeholder:text-neutral-400 transition-all"
              />
            </div>
          </form>

          {/* Nav links */}
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-gray-700 hover:text-primary py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth */}
          <div className="border-t border-gray-100 pt-3 flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-600">{user.name}</span>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-sm text-gray-500 hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-primary"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-full"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
