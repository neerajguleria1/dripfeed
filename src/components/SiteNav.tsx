import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, User, Heart, LogOut, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from './common/Logo';

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Deals', path: '/deals' },
  { label: 'Thrift', path: '/thrift' },
  { label: 'Compare', path: '/search' },
];

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/delete-account');
      logout();
      setDropdownOpen(false);
      setConfirmDelete(false);
      navigate('/');
    } catch {
      alert('Failed to delete account. Please try again.');
    }
  };

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 lg:px-16 transition-all duration-300 ease-out bg-[#171310] ${
        scrolled ? 'py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]' : 'py-3 sm:py-4'
      }`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
        {/* Logo — light variant for dark hero backgrounds */}
        <Logo variant="light" size="md" />

        {/* Center nav links - hidden on mobile, solid dark bar guarantees contrast regardless of scroll/page content */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className={`whitespace-nowrap px-4 min-h-[44px] flex items-center rounded-full font-extrabold transition-all duration-200 ease-out no-underline cursor-pointer ${
                scrolled ? 'text-xs' : 'text-sm'
              } text-white hover:text-[#C9A96E] hover:bg-white/10`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side: Search + Auth */}
        <div className="flex items-center gap-2">
          {/* Search bar - desktop. Always visible so users don't have to scroll past the hero to find it. */}
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="pl-8 pr-3 rounded-full border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E] placeholder:text-white/50 transition-all py-1.5 text-xs w-36"
            />
          </form>

          {/* Mobile search icon - always visible */}
          <button
            onClick={() => navigate('/search')}
            aria-label="Search products"
            className="sm:hidden p-2 rounded-full bg-white/10 border border-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Search className="w-4 h-4 text-white" />
          </button>

          {/* Auth section */}
          {user ? (
            /* Logged in — show user dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-1.5 rounded-full bg-white/10 text-white border border-white/25 font-medium transition-all min-h-[44px] hover:bg-white/15 ${
                  scrolled ? 'px-3 text-xs' : 'px-3 sm:px-4 text-sm'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline max-w-[80px] truncate">{user.name?.split(' ')[0] || 'Account'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-neutral-100 overflow-hidden z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-[14px] font-medium text-neutral-900 truncate">{user.name}</p>
                    <p className="text-[12px] text-neutral-400 truncate">{user.email}</p>
                  </div>

                  {/* Links */}
                  <div className="py-1.5">
                    <Link
                      to="/wishlist"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-neutral-400" />
                      My Wishlist
                    </Link>
                    <Link
                      to="/collections"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.06-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      Collections
                    </Link>
                    <Link
                      to="/thrift"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      Thrift Store
                    </Link>
                  </div>

                  {/* Logout & Delete */}
                  <div className="border-t border-neutral-100 py-1.5">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    ) : (
                      <div className="px-4 py-2.5">
                        <p className="text-[12px] text-red-600 mb-2">This will permanently delete your account, wishlists, and collections. This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDeleteAccount}
                            className="px-3 py-1.5 bg-red-600 text-white text-[12px] font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Yes, Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-3 py-1.5 border border-neutral-200 text-neutral-600 text-[12px] font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Not logged in — show Sign In. Border-only treatment so it doesn't outweigh the logo/nav. */
            <button
              onClick={() => navigate('/login')}
              className={`flex items-center gap-1.5 rounded-full border border-[#C9A96E]/60 text-[#C9A96E] font-semibold transition-all min-h-[44px] hover:bg-[#C9A96E]/10 ${
                scrolled ? 'px-3 text-xs' : 'px-3 sm:px-4 text-sm'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}




