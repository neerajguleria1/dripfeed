import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Flame, Heart, User } from 'lucide-react';

interface BottomNavProps {
  className?: string;
}

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/deals', icon: Flame, label: 'Deals' },
  { path: '/wishlist', icon: Heart, label: 'Saved' },
  { path: '/login', icon: User, label: 'Account' },
];

export function BottomNav({ className = '' }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);

  // Scroll-hide behavior: hide on scroll down, show on scroll up
  const handleScroll = useCallback(() => {
    let lastScrollY = window.scrollY;

    return () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY = currentScrollY;
    };
  }, []);

  useEffect(() => {
    const onScroll = handleScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // Don't show on auth pages
  if (location.pathname === '/login' || location.pathname === '/register') return null;

  return (
    <nav
      className={[
        'md:hidden fixed bottom-0 left-0 right-0 z-[100]',
        'bg-white/95 backdrop-blur-sm border-t border-gray-100',
        'transition-transform duration-300',
        hidden ? 'translate-y-full' : 'translate-y-0',
        className,
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={[
                'flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1',
                'transition-colors',
                active ? 'text-primary' : 'text-gray-400',
              ].join(' ')}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={[
                  'flex items-center justify-center w-8 h-8 rounded-full',
                  active ? 'bg-primary/10' : '',
                ].join(' ')}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              </span>
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
