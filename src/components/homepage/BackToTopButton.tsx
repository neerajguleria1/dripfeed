import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopButtonProps {
  /** Scroll distance in pixels before the button appears. Default: 800 */
  showAfterPx?: number;
}

/**
 * Floating "Back to top" button that appears after scrolling past a threshold.
 * Fixed bottom-right (above bottom nav), circular, brand navy background.
 * Uses smooth scroll to return to the top of the page.
 */
export default function BackToTopButton({ showAfterPx = 800 }: BackToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY >= showAfterPx);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial position in case the page loaded scrolled
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showAfterPx]);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={scrollToTop}
      className={`
        fixed bottom-20 right-4 z-50
        w-11 h-11 rounded-full
        bg-[#1A1A2E] text-white
        shadow-lg shadow-[#1A1A2E]/25
        flex items-center justify-center
        transition-all duration-300 ease-in-out
        hover:bg-[#2a2a4e] active:scale-95
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
