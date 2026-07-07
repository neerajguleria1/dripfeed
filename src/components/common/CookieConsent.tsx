import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(
      'cookieConsent',
      JSON.stringify({ status: 'accepted', timestamp: new Date().toISOString() })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[64px] sm:bottom-0 left-0 right-0 z-[90] px-3 sm:px-6 pb-3 sm:pb-4 pt-0 pointer-events-none"
    >
      <div
        className="max-w-2xl mx-auto bg-[#FFFDF9] border border-[#0F0F1A]/10 rounded-t-2xl sm:rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3 pointer-events-auto"
      >
        <p className="text-[13px] leading-relaxed text-[#0F0F1A]/70 mb-3">
          We use cookies and similar technologies to improve your experience, analyze traffic, and personalize content. By continuing, you agree to our{' '}
          <Link to="/privacy" className="underline text-[#0F0F1A]/90 hover:text-[#0F0F1A]">
            Privacy Policy
          </Link>.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 bg-[#0F0F1A] text-white text-[13px] font-medium rounded-full hover:bg-[#0F0F1A]/90 transition-colors"
          >
            Accept All
          </button>
          <Link
            to="/privacy"
            className="px-4 py-1.5 border border-[#0F0F1A]/15 text-[#0F0F1A]/70 text-[13px] font-medium rounded-full hover:bg-[#0F0F1A]/5 transition-colors"
          >
            Manage Preferences
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;

