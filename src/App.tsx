import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
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

// Marketing pages (existing)
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import BrandsPage from './pages/BrandsPage';

// Functional pages (new)
import SearchPage from './pages/SearchPage';
import ComparePage from './pages/ComparePage';
import WishlistPage from './pages/WishlistPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import CollectionsPage from './pages/CollectionsPage';
import ThriftBrowsePage from './pages/ThriftBrowsePage';
import ThriftListPage from './pages/ThriftListPage';
import CategoryPage from './pages/CategoryPage';
import BrandPage from './pages/BrandPage';
import DealsPage from './pages/DealsPage';
import { PrivacyPage, TermsPage, AffiliateDisclosurePage, NotFoundPage } from './pages/LegalPages';
import ClickStatsPage from './pages/ClickStatsPage';
import ProductDetailPage from './pages/ProductDetailPage';

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

        {/* Legal */}
        <Route path="/privacy" element={<AppLayout><PrivacyPage /></AppLayout>} />
        <Route path="/terms" element={<AppLayout><TermsPage /></AppLayout>} />
        <Route path="/affiliate-disclosure" element={<AppLayout><AffiliateDisclosurePage /></AppLayout>} />

        <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
      </Routes>
      </ErrorBoundary>
      <CookieConsent />
      <BottomNav />
      </ToastProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;
