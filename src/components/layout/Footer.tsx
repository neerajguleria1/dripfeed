import { Link } from 'react-router-dom';
import { Globe, Share2, MessageCircle } from 'lucide-react';

const quickLinks = [
  { path: '/search', label: 'Search' },
  { path: '/deals', label: 'Deals' },
  { path: '/categories', label: 'Categories' },
  { path: '/thrift', label: 'Thrift' },
  { path: '/collections', label: 'Collections' },
];

const legalLinks = [
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms of Use' },
  { path: '/affiliate-disclosure', label: 'Affiliate Disclosure' },
];

const socialLinks = [
  { href: 'https://instagram.com/dripfeed.in', label: 'Instagram', icon: Globe },
  { href: 'https://twitter.com/dripfeed_in', label: 'Twitter', icon: Share2 },
  { href: 'https://wa.me/919999999999', label: 'WhatsApp', icon: MessageCircle },
];

export interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={['bg-gray-900 text-white', className].join(' ')}>
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Logo + Tagline */}
          <div className="space-y-3">
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: 'Instrument Serif, serif' }}
            >
              Tag<span className="text-accent">Check</span>
              <span className="text-accent text-2xl leading-none">.</span>
            </span>
            <p className="text-sm text-gray-400 leading-relaxed">
              Compare fashion prices across India. Find the best deals on Myntra,
              Ajio, Amazon, Flipkart, Nykaa, Meesho, Bewakoof, and more.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Connect */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
              Connect
            </h4>
            <ul className="space-y-2">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar: ASCI disclosure + copyright */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
          <p className="text-xs text-gray-500 leading-relaxed">
            TagCheck earns commission when you buy through our links. This does
            not affect the price you pay. #Ad
          </p>
          <p className="text-xs text-gray-500">
            © 2026 TagCheck India. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
