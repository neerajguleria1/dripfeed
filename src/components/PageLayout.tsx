import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Mount animation: fade-in + slide-up
    gsap.from(contentRef.current, {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power3.out',
    });
  }, { scope: contentRef });

  return (
    <div className="min-h-screen text-[#051F45] flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-white/70 via-[#F2C4CD]/80 to-[#F2C4CD]" />
      <div className="noise-overlay" />

      {/* Top bar with back */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-16 pt-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#051F45]/60 hover:text-[#051F45] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <Link to="/" className="text-[#051F45]/40 text-xs hover:text-[#051F45]/70 transition-colors">
            DripFeed
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div ref={contentRef}>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-[-0.05em] leading-[0.85] mb-4 text-[#051F45]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[#051F45]/50 text-sm sm:text-base max-w-md mt-2">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>

      {/* Footer hint */}
      <div className="relative z-10 text-center pb-6 text-[#051F45]/20 text-xs">
        DripFeed — AI Fashion Companion
      </div>
    </div>
  );
}
