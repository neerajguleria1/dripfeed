import type { ReactNode } from 'react';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[#0F0F1A] mb-8" style={{ fontFamily: 'Instrument Serif, serif' }}>{title}</h1>
      <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-6 sm:p-8 space-y-4 text-sm text-[#0F0F1A]/80 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-semibold text-[#0F0F1A] text-lg mt-6 mb-2">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-[#0F0F1A]/90 text-[15px] mt-4 mb-1">{children}</h3>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1">{children}</ul>;
}

/* ─────────────────────────────────────────────────────────────
   PRIVACY POLICY
   ───────────────────────────────────────────────────────────── */
export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-[13px] text-[#0F0F1A]/50">Last updated: July 2026</p>

      <p>
        DripFeed India ("DripFeed", "we", "us", "our") is a sole proprietorship operating a fashion price comparison platform at dripfeed.in. We are committed to protecting your personal data in accordance with the Digital Personal Data Protection Act, 2023 (DPDPA) and applicable Indian law.
      </p>

      <H2>1. Data We Collect</H2>
      <p>We collect the following categories of personal data when you use DripFeed:</p>
      <UL>
        <li><strong>Account information:</strong> Name, email address, profile picture (if you sign in via Google)</li>
        <li><strong>Search &amp; browsing data:</strong> Search queries, product views, price comparison history</li>
        <li><strong>Wishlist &amp; collections:</strong> Products you save, collections you create</li>
        <li><strong>Style preferences:</strong> Categories, brands, budget range, occasions (from onboarding)</li>
        <li><strong>Device &amp; technical info:</strong> Browser type, device type, IP address, operating system, referral source</li>
        <li><strong>Affiliate interaction data:</strong> Clicks on affiliate links (platform, product, timestamp)</li>
      </UL>

      <H2>2. Purpose of Data Collection</H2>
      <p>We process your data for the following lawful purposes:</p>
      <UL>
        <li>Providing price comparison services across fashion platforms</li>
        <li>Personalizing product recommendations based on your preferences</li>
        <li>Sending price drop alerts and deal notifications (with your consent)</li>
        <li>Tracking affiliate link clicks for commission attribution</li>
        <li>Analytics and platform improvement</li>
        <li>Detecting and preventing fraud or abuse</li>
      </UL>

      <H2>3. Legal Basis (DPDPA 2023)</H2>
      <p>
        Under the Digital Personal Data Protection Act, 2023, we process your personal data based on your consent (provided when you create an account or continue using the platform) and for legitimate uses as permitted under the Act. You may withdraw consent at any time by deleting your account.
      </p>

      <H2>4. Data Retention</H2>
      <UL>
        <li><strong>Account data:</strong> Retained until you request deletion</li>
        <li><strong>Search and analytics data:</strong> Retained for up to 2 years, then anonymized or deleted</li>
        <li><strong>Affiliate click logs:</strong> Retained for 2 years for commission reconciliation</li>
        <li><strong>Cookies:</strong> Session cookies expire on browser close; preference cookies last up to 1 year</li>
      </UL>

      <H2>5. Your Rights Under DPDPA</H2>
      <p>As a Data Principal, you have the following rights:</p>
      <UL>
        <li><strong>Right to Access:</strong> Request a summary of your personal data we hold</li>
        <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data</li>
        <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
        <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
        <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time via account settings</li>
        <li><strong>Right to Grievance Redressal:</strong> File a complaint with our Grievance Officer</li>
      </UL>
      <p>
        To exercise any of these rights, you may delete your account from the account menu, or contact our Grievance Officer.
      </p>

      <H2>6. Cookies &amp; Tracking Technologies</H2>
      <H3>Essential Cookies</H3>
      <p>Session management, authentication state — required for the platform to function.</p>
      <H3>Preference Cookies</H3>
      <p>Store your style preferences, theme, and cookie consent status.</p>
      <H3>Analytics Cookies</H3>
      <p>Help us understand how users interact with DripFeed. We use privacy-focused analytics and do not share raw data with advertisers.</p>
      <H3>Affiliate Tracking</H3>
      <p>When you click an affiliate link, the destination platform (e.g., Amazon, Flipkart) may set its own cookies for purchase tracking. This is governed by that platform's privacy policy.</p>

      <H2>7. Third-Party Data Sharing</H2>
      <p>We share limited data with the following third parties:</p>
      <UL>
        <li><strong>Affiliate Networks:</strong> Flipkart Affiliate Program, Amazon Associates India, VCommission (Myntra, Ajio), CueLinks — receive click data (product, platform, timestamp) for commission attribution</li>
        <li><strong>Hosting &amp; Infrastructure:</strong> Vercel (hosting), MongoDB Atlas (database) — process data as sub-processors under contractual obligations</li>
        <li><strong>Analytics:</strong> Aggregated, anonymized usage data only</li>
      </UL>
      <p>We do not sell your personal data to any third party.</p>

      <H2>8. Data Security</H2>
      <p>
        We implement industry-standard security measures including encrypted connections (HTTPS/TLS), hashed passwords (bcrypt), and access controls. However, no system is 100% secure. In the event of a data breach, we will notify affected users and the Data Protection Board as required under DPDPA.
      </p>

      <H2>9. Children's Privacy</H2>
      <p>
        DripFeed is not intended for children under 13 years of age. We do not knowingly collect data from children. If you are under 18, you must have parental consent to use the platform.
      </p>

      <H2>10. Grievance Officer</H2>
      <p>In accordance with DPDPA 2023 and the Information Technology Act, 2000, we have appointed a Grievance Officer:</p>
      <div className="bg-[#0F0F1A]/5 rounded-xl p-4 mt-2">
        <p><strong>Name:</strong> Neeraj Guleria</p>
        <p><strong>Email:</strong> neerajworking51@gmail.com</p>
        <p><strong>Response time:</strong> Within 72 hours of receiving a complaint</p>
      </div>

      <H2>11. Contact Us</H2>
      <p>For general privacy inquiries:</p>
      <p><strong>Email:</strong> neerajworking51@gmail.com</p>

      <H2>12. Changes to This Policy</H2>
      <p>
        We may update this Privacy Policy from time to time. We will notify registered users of significant changes via email or in-app notification. Continued use of DripFeed after changes constitutes acceptance of the updated policy.
      </p>
    </LegalPage>
  );
}

/* ─────────────────────────────────────────────────────────────
   TERMS OF SERVICE
   ───────────────────────────────────────────────────────────── */
export function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p className="text-[13px] text-[#0F0F1A]/50">Last updated: July 2026</p>

      <p>
        These Terms of Service ("Terms") govern your use of DripFeed India ("DripFeed", "we", "us"), a fashion price comparison platform operated as a sole proprietorship. By accessing or using DripFeed, you agree to be bound by these Terms.
      </p>

      <H2>1. Acceptance of Terms</H2>
      <p>
        By creating an account or using any part of the DripFeed platform, you confirm that you have read, understood, and agree to these Terms. If you do not agree, you must stop using the platform immediately.
      </p>

      <H2>2. Service Description</H2>
      <p>DripFeed provides a free price comparison service for fashion products across multiple e-commerce platforms in India, including but not limited to:</p>
      <UL>
        <li>Comparing prices across Flipkart, Amazon, Myntra, Ajio, Meesho, and others</li>
        <li>Price drop alerts and deal notifications</li>
        <li>Product wishlists and collections</li>
        <li>Personalized fashion recommendations</li>
        <li>A peer-to-peer thrift marketplace for pre-owned fashion</li>
      </UL>
      <p>
        DripFeed does not sell products, process payments, or handle delivery. We redirect you to third-party platforms where you complete your purchase independently.
      </p>

      <H2>3. Affiliate Disclosure</H2>
      <p>
        DripFeed operates on an affiliate commerce model and intends to earn commissions from affiliate programs when you purchase products through our links, once those programs are active. This is how we plan to keep the platform free. Commissions never affect the price you pay. See our full <a href="/affiliate-disclosure" className="underline hover:text-[#0F0F1A]">Affiliate Disclosure</a> for details on which programs are currently active.
      </p>

      <H2>4. User Accounts</H2>
      <UL>
        <li>You must be at least 13 years old to create an account</li>
        <li>You must provide accurate and truthful information</li>
        <li>One account per person — multiple accounts are not permitted</li>
        <li>You are responsible for maintaining the confidentiality of your login credentials</li>
        <li>Notify us immediately if you suspect unauthorized access to your account</li>
      </UL>

      <H2>5. Price Accuracy Disclaimer</H2>
      <p>
        Prices displayed on DripFeed are sourced from third-party platforms and cached periodically. While we strive for accuracy, we cannot guarantee that prices shown are current or error-free. <strong>Always verify the final price on the destination platform before making a purchase.</strong> DripFeed is not responsible for price discrepancies, stock availability, or promotional eligibility on third-party sites.
      </p>

      <H2>6. Intellectual Property</H2>
      <UL>
        <li>The DripFeed platform (code, design, branding, logo) is owned by DripFeed India</li>
        <li>Product data, images, and prices belong to their respective platforms and brands</li>
        <li>You may not reproduce, distribute, or create derivative works of the DripFeed platform without permission</li>
      </UL>

      <H2>7. User Content (Thrift Listings)</H2>
      <p>When you list items on the DripFeed Thrift marketplace:</p>
      <UL>
        <li>You retain ownership of your content (photos, descriptions)</li>
        <li>You grant DripFeed a non-exclusive, royalty-free license to display, distribute, and promote your listing on the platform</li>
        <li>You are responsible for the accuracy of your listing and the condition of items sold</li>
        <li>Listings must comply with applicable laws — no counterfeit, stolen, or prohibited items</li>
      </UL>

      <H2>8. Prohibited Use</H2>
      <p>You agree not to:</p>
      <UL>
        <li>Scrape, crawl, or programmatically access DripFeed without written permission</li>
        <li>Create fake or multiple accounts</li>
        <li>Manipulate prices, reviews, or affiliate tracking</li>
        <li>Use the platform for any illegal activity</li>
        <li>Attempt to circumvent security measures or access restricted areas</li>
        <li>Post misleading, offensive, or harmful content</li>
        <li>Use automated tools to generate clicks or inflate metrics</li>
      </UL>

      <H2>9. Limitation of Liability</H2>
      <p>
        DripFeed is a comparison and discovery platform. We are <strong>not liable</strong> for:
      </p>
      <UL>
        <li>Purchases made on third-party platforms (returns, refunds, quality issues are governed by those platforms)</li>
        <li>Price changes, out-of-stock items, or coupon validity on third-party sites</li>
        <li>Losses arising from reliance on information displayed on DripFeed</li>
        <li>Thrift marketplace transactions between users</li>
      </UL>
      <p>
        To the maximum extent permitted by law, DripFeed's total liability for any claim shall not exceed ₹1,000 or the amount you paid to DripFeed (which is ₹0 for free users).
      </p>

      <H2>10. Termination</H2>
      <p>
        DripFeed may suspend or terminate your account at any time if you violate these Terms, engage in abusive behavior, or for any other reason at our discretion. Upon termination, your right to use the platform ceases immediately. You may delete your own account at any time from the account menu.
      </p>

      <H2>11. Governing Law &amp; Jurisdiction</H2>
      <p>
        These Terms are governed by the laws of India. Any disputes arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the courts in Shimla, Himachal Pradesh, India.
      </p>

      <H2>12. Compliance with IT Act, 2000</H2>
      <p>
        DripFeed operates as an intermediary under the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. We:
      </p>
      <UL>
        <li>Provide a mechanism for users to report violations</li>
        <li>Remove unlawful content upon receiving valid legal notice</li>
        <li>Maintain logs as required under applicable regulations</li>
        <li>Have appointed a Grievance Officer as required under Rule 3(2)</li>
      </UL>

      <H2>13. Grievance Officer</H2>
      <div className="bg-[#0F0F1A]/5 rounded-xl p-4 mt-2">
        <p><strong>Name:</strong> Neeraj Guleria</p>
        <p><strong>Email:</strong> neerajworking51@gmail.com</p>
        <p><strong>Response time:</strong> Acknowledgment within 24 hours, resolution within 15 days</p>
      </div>

      <H2>14. Changes to These Terms</H2>
      <p>
        We may modify these Terms at any time. We will notify users of material changes via email or in-app notice. Continued use after notification constitutes acceptance.
      </p>

      <H2>15. Contact</H2>
      <p><strong>Email:</strong> neerajworking51@gmail.com</p>
    </LegalPage>
  );
}

/* ─────────────────────────────────────────────────────────────
   AFFILIATE DISCLOSURE
   ───────────────────────────────────────────────────────────── */
export function AffiliateDisclosurePage() {
  return (
    <LegalPage title="Affiliate Disclosure">
      <p className="text-[13px] text-[#0F0F1A]/50">Last updated: July 2026</p>

      <div className="bg-[#0F0F1A]/5 rounded-xl p-4 mb-4">
        <p className="text-[15px] font-medium text-[#0F0F1A]">
          DripFeed operates on an affiliate commerce model. We are in the process of joining affiliate programs including Amazon Associates India, the Flipkart Affiliate Program, VCommission, and CueLinks. Where an active affiliate relationship is not yet established for a given link, that link takes you directly to the platform with no commission earned.
        </p>
      </div>

      <H2>What This Means</H2>
      <p>
        Once fully onboarded to each affiliate program, DripFeed will earn a small commission when you click a link that takes you to an external shopping platform and make a purchase — <strong>at no extra cost to you</strong>. You pay exactly the same price whether you use our link or go directly to the platform. Until an affiliate relationship is active for a given platform, links to that platform are plain (non-commissioned) links.
      </p>

      <H2>How to Identify Affiliate Links</H2>
      <UL>
        <li>Links marked with <span className="inline-block bg-[#0F0F1A]/10 px-2 py-0.5 rounded text-[12px] font-medium">#Ad</span> are affiliate links</li>
        <li>All "Buy on [Platform]" buttons lead to affiliate-tracked URLs</li>
        <li>Links leading to external shopping platforms (Amazon, Flipkart, Myntra, Ajio, etc.) are affiliate links</li>
      </UL>

      <H2>Independence of Recommendations</H2>
      <p>
        Our recommendations and price comparisons are independent. Commissions do not influence which platform shows as cheapest or which products we recommend. Our comparison algorithm shows the lowest price regardless of which affiliate program pays more. We display prices from all platforms equally.
      </p>

      <H2>Affiliate Programs We Work With</H2>
      <p>
        DripFeed is being onboarded to the following affiliate programs. A program is only active for a platform once approval and tracking IDs are in place — until then, links to that platform are not commissioned.
      </p>
      <UL>
        <li><strong>Amazon Associates India</strong> — for amazon.in products</li>
        <li><strong>Flipkart Affiliate Program</strong> — for flipkart.com products</li>
        <li><strong>VCommission</strong> — for Myntra, Ajio, Nykaa Fashion, Meesho</li>
        <li><strong>CueLinks</strong> — for additional platform coverage and deep-link support</li>
      </UL>

      <H2>Why We Use Affiliate Links</H2>
      <p>
        DripFeed is a free platform. We do not charge users for price comparison, wishlist features, or deal alerts. Affiliate commissions are our primary revenue source and allow us to keep the platform free, ad-light, and focused on helping you find the best prices.
      </p>

      <H2>ASCI Compliance</H2>
      <p>
        All promotional content on DripFeed is clearly marked as per the Advertising Standards Council of India (ASCI) Guidelines for Influencer Advertising in Digital Media. We believe in full transparency about our business model and commercial relationships.
      </p>

      <H2>FTC-Style Transparency Statement</H2>
      <p>
        In the interest of full disclosure: DripFeed earns money when you buy things through our links. We only recommend or compare products we believe provide genuine value. Our editorial opinions are our own and are not influenced by affiliate partnerships. If a product is bad or overpriced, we will say so regardless of commission potential.
      </p>

      <H2>Questions?</H2>
      <p>
        If you have questions about our affiliate relationships or how we make money, feel free to reach out at <strong>neerajworking51@gmail.com</strong>. We're happy to be transparent about everything.
      </p>
    </LegalPage>
  );
}

/* ─────────────────────────────────────────────────────────────
   404 NOT FOUND
   ───────────────────────────────────────────────────────────── */
export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl mb-4 font-bold text-[#0F0F1A]/10">404</p>
      <h1 className="text-2xl font-bold text-[#0F0F1A] mb-2" style={{ fontFamily: 'Instrument Serif, serif' }}>Page not found</h1>
      <p className="text-[#0F0F1A]/60 mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="bg-[#0F0F1A] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#0F0F1A]/90">
        Go Home
      </a>
    </div>
  );
}

