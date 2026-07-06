import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Main layout wrapper providing consistent page structure:
 * Header (fixed top) → Main content (flex-1) → Footer.
 * Adds bottom padding on mobile to account for the BottomNav.
 */
export function AppShell({ children }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className="flex flex-col min-h-screen bg-bg-warm">
      <Header />

      {/* Main content area — push below fixed header, add bottom padding on mobile for BottomNav */}
      <main
        className={[
          'flex-1',
          isDesktop ? 'pt-16' : 'pt-14 pb-16',
        ].join(' ')}
      >
        {children}
      </main>

      <Footer />
    </div>
  );
}

export default AppShell;
