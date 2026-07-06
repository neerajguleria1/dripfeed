import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Sparkles, TrendingUp, BarChart3,
  Target, Zap, Eye, Package, Megaphone, LineChart,
  ShoppingBag, Users, ChevronRight, Star, RotateCcw,
  Globe, Shield, Heart, ArrowUp,
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/* \u2500\u2500 Data \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const problems = [
  { icon: Eye, title: 'Discovery is broken', desc: 'Shoppers browse TikTok/Instagram, but it\'s hard for brands to turn that attention into measurable sales.', stat: '73%', statLabel: 'of shoppers abandon' },
  { icon: Zap, title: 'Performance traffic is noisy', desc: 'Brands pay for clicks, yet traffic quality varies and return rates are high.', stat: '40%', statLabel: 'return rate' },
  { icon: ShoppingBag, title: 'Brand equity vs. value', desc: 'Shoppers are price-sensitive, but constant discounting erodes the brand.', stat: '2.3x', statLabel: 'brand erosion' },
  { icon: BarChart3, title: 'Fragmented data', desc: 'Intent, onsite activity, and campaign data live in separate tools.', stat: '5+', statLabel: 'data silos' },
];

const features = [
  { icon: Sparkles, title: 'Curated discovery', desc: 'Your products appear in high-intent environments\u2014styled looks, curated edits, and search\u2014where shoppers are ready to buy.', tag: 'Discovery' },
  { icon: Users, title: 'Make customers', desc: 'We reach shoppers you\'re not converting today and drive them to full-price and in-season products.', tag: 'Growth' },
  { icon: Package, title: 'Lower returns by 50%', desc: 'Sizing insights and retargeting help shoppers choose right the first time, reducing costly returns.', tag: 'Efficiency' },
  { icon: Megaphone, title: 'Media Opportunities', desc: 'Get added visibility through DripFeed-owned media: founders\' channels, company content, and in-app placements.', tag: 'Visibility' },
  { icon: LineChart, title: 'Actionable data', desc: 'Access dashboards with performance & benchmarks for merchandising and marketing. (available Jan 2026)', tag: 'Analytics' },
  { icon: Shield, title: 'Brand safety', desc: 'Your products appear only in curated, on-brand environments that protect your equity and reputation.', tag: 'Trust' },
];

const mediaFeatures = [
  { title: 'Curated Editorials', desc: 'Magazine-style edits curated to shoppers\' taste \u2014 think "Office Look Essentials," "Winter Capsule," etc \u2014 where products appear as part of styled, shop-ready outfits.', benefit: 'Boosts brand relevance and storytelling: Appear alongside on-trend looks, seasonal themes, and style moments that reflect what users are actively searching for.', icon: Star },
  { title: 'Personalized Feeds', desc: 'A fully personalized shopping feed that surfaces products based on each shopper\'s browsing patterns, saved items, and style signals.', benefit: 'Targeted exposure: Your products appear in front of shoppers who\'ve shown interest in similar categories, materials, silhouettes, or price points.', icon: Target },
  { title: 'Brand Spotlights', desc: 'A dedicated in-app page where shoppers browse your products and revisit items they\'ve viewed or saved.', benefit: 'High-intent discovery: Shoppers arrive here specifically to explore your brand\u2014not to scroll through discounts or low-intent traffic.', icon: Globe },
  { title: 'Social Activations', desc: 'Visibility across DripFeed\'s social channels where we share trending products, brand moments, and seasonal stories with our 1.4M+ followers.', benefit: 'Amplified reach: Put your products in front of a broader audience of fashion-focused consumers who follow DripFeed for inspiration.', icon: Heart },
];

const steps = [
  { num: '01', title: 'No integration fees', desc: 'We connect via your existing affiliate setup', icon: Shield },
  { num: '02', title: 'Set commercial offer', desc: 'Via your affiliate network (typically 20%)', icon: TrendingUp },
  { num: '03', title: '1-2 weeks setup', desc: 'Tracking, product catalog, quality checks', icon: RotateCcw },
  { num: '04', title: 'Go live on DripFeed', desc: 'Your brand appears in DripFeed\'s discovery feed, search and curated edits', icon: Zap },
  { num: '05', title: 'Performance review', desc: 'Evaluate results and ways to scale (exposure, exclusives, media packages)', icon: BarChart3 },
];

/* \u2500\u2500 Component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

export default function BrandsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [activeProblem, setActiveProblem] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveProblem((prev) => (prev + 1) % problems.length), 4000);
    return () => clearInterval(interval);
  }, []);

  /* \u2500\u2500 GSAP Animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-badge', { opacity: 0, y: 20, duration: 0.5 })
      .from('.hero-title', { opacity: 0, y: 50, duration: 0.7 }, '-=0.3')
      .from('.hero-subtitle', { opacity: 0, y: 30, duration: 0.5 }, '-=0.4')
      .from('.hero-cta', { opacity: 0, y: 20, duration: 0.4 }, '-=0.3');
  }, { scope: heroRef });

  return (
    <div className="min-h-screen text-[#051F45] flex flex-col relative">

      {/* \u2500\u2500 Sticky Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F2C4CD]/60 backdrop-blur-[12px] shadow-[0_4px_20px_rgba(5,31,69,0.06)]" style={{backgroundBlendMode: 'luminosity'}}>
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 lg:px-8 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="inline-flex items-center gap-2 text-[#051F45]/60 hover:text-[#051F45] transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="#problems" className="text-sm font-medium text-[#051F45] hover:text-[#051F45]/70 transition-colors">Brands</a>
            </div>
          </div>
          <Link to="/" className="text-[#051F45] font-serif text-xl font-bold tracking-tight">DripFeed</Link>
          <button onClick={() => navigate('/', { state: { scrollTo: 'early-join' } })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#051F45] text-[#051F45] text-sm font-medium hover:bg-[#051F45] hover:text-white transition-all duration-300">
            Partner with us
          </button>
        </div>
      </header>

      {/* \u2500\u2500 Hero Section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section ref={heroRef} className="relative z-10 px-6 lg:px-8 pt-40 pb-20 md:pt-48 md:pb-28">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#051F45]/8 bg-white/80 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#051F45]/60">Partner with DripFeed</span>
          </div>
          <h1 className="hero-title font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-bold leading-[1.05] tracking-[-0.02em] text-[#051F45] mb-6">
            The next era of fashion
          </h1>
          <p className="hero-subtitle text-[#051F45]/50 text-lg sm:text-xl max-w-[600px] mx-auto leading-relaxed mb-10">
            Put your products where they're looking — in trending feeds, exclusive deals, and curated collections that convert.
          </p>
          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/', { state: { scrollTo: 'early-join' } })}
              className="group inline-flex items-center gap-3 bg-[#051F45] rounded-full text-white font-semibold text-sm px-8 py-4 transition-all duration-500 hover:gap-4 hover:shadow-2xl hover:shadow-[#051F45]/20">
              <span>Get in Touch</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#problems" className="inline-flex items-center gap-2 text-[#051F45]/50 hover:text-[#051F45] text-sm font-medium transition-colors">
              See why brands switch<ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>


      {/* \u2500\u2500 Problem Grid (Bento 2x2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section id="problems" className="relative z-10 px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-[#051F45]/8 bg-white/80 text-[10px] font-mono tracking-[0.2em] uppercase text-[#051F45]/50 mb-4">The Problem</span>
            <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] text-[#051F45]">The problem for fashion merchants today</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {problems.map((problem, i) => {
              const Icon = problem.icon;
              const isActive = activeProblem === i;
              return (
                <div key={problem.title}
                  className={`problem-card group relative rounded-2xl p-7 cursor-pointer transition-all duration-500 ${isActive ? 'bg-[#051F45] text-white shadow-2xl shadow-[#051F45]/15 -translate-y-1 scale-[1.01]' : 'bg-white/70 backdrop-blur-sm border border-white/50 hover:bg-white/90 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#051F45]/5'}`}
                  onMouseEnter={() => setActiveProblem(i)}>
                  <div className="flex items-start gap-4">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-all duration-300 ${isActive ? 'bg-white/15 text-white' : 'bg-white text-[#051F45] border border-[#051F45]/8 shadow-sm'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-white/70' : 'text-[#051F45]/50'}`}>{problem.desc}</p>
                    </div>
                  </div>
                  <div className={`mt-5 pt-5 border-t flex items-baseline gap-3 transition-all duration-300 ${isActive ? 'border-white/15' : 'border-[#051F45]/5'}`}>
                    <span className="font-serif text-4xl font-bold">{problem.stat}</span>
                    <span className={`text-xs uppercase tracking-wider ${isActive ? 'text-white/50' : 'text-[#051F45]/30'}`}>{problem.statLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* \u2500\u2500 AI Assistant Feature \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section className="relative z-10 px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="relative rounded-3xl bg-[#051F45] p-10 md:p-16 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#F2C4CD]/10 rounded-full blur-[60px]" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-[10px] font-mono tracking-[0.2em] uppercase text-white/70 mb-6">
                  <Sparkles className="w-3 h-3" />AI Shopping Assistant
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-tight mb-6">
                  DripFeed is an AI shopping platform that helps shoppers find the right products faster with recommendations tailored to each shopper's style and behavior.
                </h2>

              </div>
              <div className="space-y-4">
                {[
                  { icon: TrendingUp, text: 'High-intent discovery' },
                  { icon: Target, text: 'Personalized recommendations' },
                  { icon: Shield, text: 'Privacy-compliant data' },
                  { icon: Zap, text: 'Real-time price tracking' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
                      <Icon className="w-5 h-5 text-[#F2C4CD]" />
                      <span className="text-white/80 text-sm">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* \u2500\u2500 Features Section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section className="relative z-10 px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-[#051F45]/8 bg-white/80 text-[10px] font-mono tracking-[0.2em] uppercase text-[#051F45]/50 mb-4">Why Partner</span>
            <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] text-[#051F45]">Why partner with DripFeed?</h2>
            <p className="text-[#051F45]/50 text-base max-w-2xl mx-auto mt-4">We turn high-intent discovery into incremental revenue, bringing you new customers and higher-quality orders while protecting your brand equity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="feature-item group relative rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 p-6 transition-all duration-500 hover:bg-white/90 hover:shadow-lg hover:shadow-[#051F45]/5 hover:-translate-y-1">
                  <div className="inline-block px-2.5 py-1 rounded-full bg-white border border-[#051F45]/8 text-[9px] font-mono tracking-wider uppercase text-[#051F45]/50 mb-4">{feature.tag}</div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-[#051F45]/8 mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <Icon className="w-5 h-5 text-[#051F45]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#051F45] mb-2">{feature.title}</h3>
                  <p className="text-[#051F45]/50 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* \u2500\u2500 Media Opportunities (Asymmetric Split) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section className="relative z-10 px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-[#051F45]/8 bg-white/80 text-[10px] font-mono tracking-[0.2em] uppercase text-[#051F45]/50 mb-4">Media Opportunities</span>
            <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] text-[#051F45]">Amplify your reach</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {mediaFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="media-card group relative rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-[#051F45]/5 hover:-translate-y-1">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#051F45] to-[#1a4a8b] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#051F45] text-white">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold text-[#051F45]">{feature.title}</h3>
                    </div>
                    <p className="text-[#051F45]/60 text-sm leading-relaxed mb-4">{feature.desc}</p>
                    <div className="pt-4 border-t border-[#051F45]/5">
                      <p className="text-[#051F45]/40 text-xs leading-relaxed">{feature.benefit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* \u2500\u2500 How to Get Started \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section id="steps" className="relative z-10 px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-[#051F45]/8 bg-white/80 text-[10px] font-mono tracking-[0.2em] uppercase text-[#051F45]/50 mb-4">Get Started</span>
            <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] text-[#051F45]">How to get started</h2>
          </div>
          <div className="relative">
            <div className="absolute left-[27px] top-0 bottom-0 w-px bg-[#051F45]/8" />
            <div className="space-y-4">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.num} className="step-item group relative flex items-start gap-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 p-6 hover:bg-white/90 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#051F45]/5">
                    <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-[#051F45] text-white shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 pt-2">
                      <span className="text-[10px] font-mono text-[#051F45]/30 tracking-wider">STEP {step.num}</span>
                      <h3 className="text-lg font-bold text-[#051F45] mb-1">{step.title}</h3>
                      <p className="text-[#051F45]/50 text-sm">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* \u2500\u2500 Closing CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      <section className="relative z-10 px-6 lg:px-8 py-24 md:py-32 text-center">
        <div className="max-w-[600px] mx-auto">
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] text-[#051F45] mb-6">Ready to get started?</h2>
          <p className="text-[#051F45]/50 text-base max-w-md mx-auto mb-10">Join hundreds of brands already driving sales with DripFeed.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/', { state: { scrollTo: 'early-join' } })}
              className="group inline-flex items-center gap-3 bg-[#051F45] rounded-full text-white font-semibold text-sm px-8 py-4 transition-all duration-500 hover:gap-4 hover:shadow-2xl hover:shadow-[#051F45]/20">
              <span>Get in touch</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* \u2500\u2500 Back to Top \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      {showBackToTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm border border-[#F2C4CD]/30 shadow-lg shadow-[#051F45]/5 text-[#051F45]/60 hover:text-[#051F45] text-xs font-medium transition-all duration-300 hover:shadow-xl hover:bg-white hover:border-[#F2C4CD]/60">
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Back to top</span>
        </button>
      )}
    </div>
  );
}


