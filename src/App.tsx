import { Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { useRecentlyViewed } from './hooks/useRecentlyViewed';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PersistentBg from './components/PersistentBg';
import AppHeader from './components/AppHeader';
import BottomNav from './components/layout/BottomNav';
import { CookieConsent } from './components/common/CookieConsent';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// ─── Eagerly loaded — these are the entry-point pages ──────────────────────
// HomePage is the first thing visitors see; load it immediately.
// LoginPage/RegisterPage are high-priority for returning users.
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// ─── Lazily loaded — split into separate chunks ────────────────────────────
// These pages are only visited by users who navigate past the homepage.
// Each becomes its own JS chunk (vendor libs already split in vite.config.ts).
const HowItWorksPage   = lazy(() => import('./pages/HowItWorksPage'));
const BrandsPage       = lazy(() => import('./pages/BrandsPage'));
const SearchPage       = lazy(() => import('./pages/SearchPage'));
const ComparePage      = lazy(() => import('./pages/ComparePage'));
const WishlistPage     = lazy(() => import('./pages/WishlistPage'));
const AdminPage        = lazy(() => import('./pages/AdminPage'));
const CollectionsPage  = lazy(() => import('./pages/CollectionsPage'));
const ThriftBrowsePage = lazy(() => import('./pages/ThriftBrowsePage'));
const ThriftListPage   = lazy(() => import('./pages/ThriftListPage'));
const CategoryPage     = lazy(() => import('./pages/CategoryPage'));
const BrandPage        = lazy(() => import('./pages/BrandPage'));
const DealsPage        = lazy(() => import('./pages/DealsPage'));
const ClickStatsPage   = lazy(() => import('./pages/ClickStatsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const LegalPages = lazy(() => import('./pages/LegalPages'));

// ─── Minimal inline fallback ───────────────────────────────────────────────
// Single element, no dependencies — renders instantly while chunk loads.
function PageFallback() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Registers post-login sync so anonymous history merges on login. */
function RecentlyViewedSync() {
  const { user, setOnLoginSuccess } = useAuth();
  const { syncAfterLogin } = useRecentlyViewed(!!user);
  useEffect(() => {
    setOnLoginSuccess(syncAfterLogin);
    return () => setOnLoginSuccess(null);
  }, [syncAfterLogin, setOnLoginSuccess]);
  return null;
}

// Auth pages — no header, no persistent bg
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PersistentBg />
      <div className="relative z-10">{children}</div>
    </>
  );
}

// All other pages — with persistent bg + app header
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PersistentBg />
      <div className="relative z-10">
        <AppHeader />
        <main>{children}</main>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <RecentlyViewedSync />
      <PreferencesProvider>
      <ToastProvider>
      <ScrollToTop />
      <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Auth — no header */}
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />

        {/* Marketing — no app header (uses SiteNav inside) */}
        <Route path="/" element={<div className="relative"><HomePage /></div>} />
        <Route path="/how-it-works" element={<div className="relative"><HowItWorksPage /></div>} />
        <Route path="/brands" element={<div className="relative"><BrandsPage /></div>} />

        {/* Functional — with AppHeader */}
        <Route path="/search" element={<AppLayout><SearchPage /></AppLayout>} />
        <Route path="/compare" element={<AppLayout><ComparePage /></AppLayout>} />
        <Route path="/wishlist" element={<AppLayout><ProtectedRoute><WishlistPage /></ProtectedRoute></AppLayout>} />
        <Route path="/collections" element={<AppLayout><ProtectedRoute><CollectionsPage /></ProtectedRoute></AppLayout>} />
        <Route path="/deals" element={<AppLayout><DealsPage /></AppLayout>} />
        <Route path="/category/:slug" element={<AppLayout><CategoryPage /></AppLayout>} />
        <Route path="/brand/:slug" element={<AppLayout><BrandPage /></AppLayout>} />
        <Route path="/thrift" element={<AppLayout><ThriftBrowsePage /></AppLayout>} />
        <Route path="/thrift/list" element={<AppLayout><ThriftListPage /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><AdminRoute><AdminPage /></AdminRoute></AppLayout>} />
        <Route path="/stats" element={<AppLayout><ClickStatsPage /></AppLayout>} />
        <Route path="/product/:canonicalId" element={<AppLayout><ProductDetailPage /></AppLayout>} />

        {/* Legal — loaded from single lazy chunk */}
        <Route path="/privacy" element={<AppLayout><LegalPages page="privacy" /></AppLayout>} />
        <Route path="/terms" element={<AppLayout><LegalPages page="terms" /></AppLayout>} />
        <Route path="/affiliate-disclosure" element={<AppLayout><LegalPages page="disclosure" /></AppLayout>} />

        <Route path="*" element={<AppLayout><LegalPages page="404" /></AppLayout>} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <CookieConsent />
      <BottomNav />
      </ToastProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;
