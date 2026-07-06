import type { ReactNode } from 'react';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[#051F45] mb-8" style={{ fontFamily: 'Instrument Serif, serif' }}>{title}</h1>
      <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#051F45]/10 p-8 space-y-4 text-sm text-[#051F45]/80 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-semibold text-[#051F45] text-lg mt-6">{children}</h2>;
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: 2026. DripFeed India ("we", "us") is committed to protecting your privacy.</p>
      <H2>Data We Collect</H2>
      <p>We collect your name, email address, and search history when you create an account. We do not collect payment information — we never process payments.</p>
      <H2>How We Use Your Data</H2>
      <p>We use your data to provide price comparison services, send price drop alerts (if you opt in), and improve our platform. We do not sell your data to third parties.</p>
      <H2>Affiliate Tracking</H2>
      <p>When you click a "Buy on X" button, we redirect you through an affiliate link. The destination platform may set cookies for purchase tracking. We log the click (platform, product, timestamp) for our own analytics.</p>
      <H2>Contact</H2>
      <p>For privacy concerns, email us at privacy@dripfeed.in</p>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>By using DripFeed India, you agree to these terms.</p>
      <H2>Service Description</H2>
      <p>DripFeed India is a price comparison platform. We display prices from third-party e-commerce platforms and redirect users via affiliate links. We do not sell products, process payments, or handle delivery.</p>
      <H2>Accuracy of Prices</H2>
      <p>Prices are fetched in real-time and cached for up to 15 minutes. Actual prices on the destination platform may differ. Always verify the final price before purchasing.</p>
      <H2>Prohibited Use</H2>
      <p>You may not scrape, automate, or abuse our platform. Accounts found doing so will be terminated.</p>
      <H2>Contact</H2>
      <p>For questions, email legal@dripfeed.in</p>
    </LegalPage>
  );
}

export function AffiliateDisclosurePage() {
  return (
    <LegalPage title="Affiliate Disclosure">
      <p className="text-base font-medium text-[#051F45]">
        #Ad: DripFeed India earns a commission when you buy through our links.
      </p>
      <p>This never affects the price you pay. You pay exactly the same price whether you use our link or go directly to the platform.</p>
      <H2>How It Works</H2>
      <p>When you click "Buy on Myntra" (or any platform), we redirect you through an affiliate link. If you complete a purchase within the cookie window (typically 24–30 days), we earn a small commission from the platform — not from you.</p>
      <H2>Our Affiliate Partners</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Amazon Associates India</li>
        <li>VCommission (Myntra, Ajio, Nykaa, Meesho)</li>
        <li>Flipkart Affiliate Program</li>
        <li>Cuelinks</li>
      </ul>
      <p className="mt-4">This disclosure complies with ASCI Guidelines for Influencer Advertising in Digital Media.</p>
    </LegalPage>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl mb-4 font-bold text-[#051F45]/10">404</p>
      <h1 className="text-2xl font-bold text-[#051F45] mb-2" style={{ fontFamily: 'Instrument Serif, serif' }}>Page not found</h1>
      <p className="text-[#051F45]/60 mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="bg-[#051F45] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#051F45]/90">
        Go Home
      </a>
    </div>
  );
}
