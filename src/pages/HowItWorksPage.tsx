import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTypewriter } from '../hooks/useTypewriter';
import { Search, Bell, TrendingUp, Shield, Zap, ArrowRight, Sparkles, Layers, BarChart3, Smartphone, Globe, Lock, Star } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Search, title: 'Universal Search', desc: 'One search bar. Every platform. Find any product across 20+ stores instantly.', gradient: 'from-pink-500/40 to-purple-500/30' },
  { icon: Bell, title: 'Price Drop Alerts', desc: "Set it and forget it. We'll ping you the second prices fall.", gradient: 'from-blue-500/40 to-cyan-500/30' },
  { icon: TrendingUp, title: 'Trend Radar', desc: "See what's hot before everyone else. Real-time fashion intelligence.", gradient: 'from-orange-500/40 to-red-500/30' },
  { icon: Shield, title: 'Zero Data Sharing', desc: 'Your taste, your business. We never sell or share your data.', gradient: 'from-green-500/40 to-emerald-500/30' },
  { icon: Zap, title: 'Live Price Feed', desc: 'Prices update every 5 minutes. No stale data, no missed deals.', gradient: 'from-yellow-500/40 to-amber-500/30' },
  { icon: Layers, title: 'Wishlist Sync', desc: 'Connect your existing wishlists. We track them all in one place.', gradient: 'from-indigo-500/40 to-violet-500/30' },
];

const steps = [
  { num: '01', title: 'Search', desc: 'Type a product name, paste a link, or upload a photo.', icon: Search, color: 'from-pink-500 to-rose-500' },
  { num: '02', title: 'Compare', desc: 'See prices across all platforms side by side.', icon: BarChart3, color: 'from-blue-500 to-cyan-500' },
  { num: '03', title: 'Track', desc: 'Set alerts. We monitor 24/7 and notify you instantly.', icon: Bell, color: 'from-violet-500 to-purple-500' },
  { num: '04', title: 'Save', desc: 'Buy at the lowest price. Average savings: 40%.', icon: Sparkles, color: 'from-amber-500 to-orange-500' },
];

const platforms = ['Myntra', 'Ajio', 'Flipkart', 'Amazon', 'Nykaa', 'Tata CLiQ', 'Limeroad', 'Snapdeal'];

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const prevMouseX = useRef(0);
  const isScrubbing = useRef(false);

  const { displayed, done } = useTypewriter("Smart Shopping\nMade Simple", 38, 600);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      if (!isScrubbing.current) {
        prevMouseX.current = e.clientX;
        isScrubbing.current = true;
      }
      const delta = e.clientX - prevMouseX.current;
      prevMouseX.current = e.clientX;
      if (video.duration) {
        const target = video.currentTime + (delta / window.innerWidth) * 0.8 * video.duration;
        video.currentTime = Math.max(0, Math.min(target, video.duration));
      }
    };

    const handleMouseUp = () => { isScrubbing.current = false; };
    const handleMouseLeave = () => { isScrubbing.current = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseLeave);

    if (window.innerWidth < 1024) {
      video.autoplay = true;
      video.play().catch(() => {});
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (textRef.current) {
        gsap.from(textRef.current, { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', delay: 0.2 });
      }

      if (stepsRef.current) {
        const stepItems = stepsRef.current.querySelectorAll('.step-card');
        if (stepItems.length) {
          gsap.fromTo(stepItems,
            { opacity: 0, y: 50, scale: 0.95 },
            {
              scrollTrigger: { trigger: stepsRef.current, start: 'top 80%' },
              opacity: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.7, ease: 'power3.out',
            }
          );
        }
      }

      if (featuresRef.current) {
        const featureItems = featuresRef.current.querySelectorAll('.feature-item');
        if (featureItems.length) {
          gsap.fromTo(featureItems,
            { opacity: 0, y: 40 },
            {
              scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' },
              opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out',
            }
          );
        }
      }

      if (marqueeRef.current) {
        gsap.to(marqueeRef.current, {
          x: '-50%',
          duration: 30,
          ease: 'none',
          repeat: -1,
        });
      }
    }, pageRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="w-full bg-[#C9A96E]">
      {/* Hero */}
      <div className="w-full min-h-screen flex items-center justify-center p-3 md:p-5">
        <section className="relative w-full max-w-[1536px] h-full min-h-screen rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex flex-col items-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover object-[65%] lg:object-center z-0"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260428_193507_4286c423-2fd9-4efd-92bd-91a939453fc1.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#C9A96E]/40 via-transparent to-[#C9A96E]/60 z-[1]" />

          <div className="relative z-10 w-full h-full flex flex-col items-center">
            <nav className="flex items-center justify-between py-6 px-6 md:px-10 w-full">
              <span className="tracking-tighter text-xl text-[#0F0F1A]">DripFeed</span>
            </nav>

            <div ref={textRef} className="w-full flex flex-col items-center pt-12 md:pt-20 px-6 text-center max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 backdrop-blur-md border border-white/30 mb-6"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0F0F1A]" />
                <span className="text-xs text-[#0F0F1A]/80">AI-Powered Price Intelligence</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-[90px] font-normal text-[#0F0F1A] mb-4 tracking-tight leading-[1.02]"
              >
                {displayed}
                {!done && (
                  <span className="inline-block w-[3px] h-[1.1em] bg-[#0F0F1A] align-middle ml-[2px] animate-blink" />
                )}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-base md:text-lg text-[#0F0F1A]/70 leading-relaxed max-w-lg font-normal mb-10"
              >
                Stop overpaying. Compare prices across every major e-commerce platform in real-time.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <button
                  onClick={() => navigate('/', { state: { scrollTo: 'early-join' } })}
                  className="group flex items-center gap-3 bg-[#0F0F1A] text-white px-8 py-4 rounded-full text-sm font-medium hover:bg-[#0F0F1A]/90 transition-all hover:gap-4"
                >
                  Start Saving
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>

              {/* Floating Glass Elements */}
              <div className="hidden lg:block absolute top-20 left-4 xl:left-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="p-3 rounded-2xl bg-white/30 backdrop-blur-xl border border-white/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-[#0F0F1A]/50">Price Drop</div>
                      <div className="text-sm font-medium text-[#0F0F1A]">-42%</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="hidden lg:block absolute top-24 right-4 xl:right-8">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 1 }}
                  className="p-3 rounded-2xl bg-white/30 backdrop-blur-xl border border-white/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-[#0F0F1A]/50">Tracking</div>
                      <div className="text-sm font-medium text-[#0F0F1A]">24/7</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="hidden lg:block absolute bottom-48 left-4 xl:left-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.2 }}
                  className="p-3 rounded-2xl bg-white/30 backdrop-blur-xl border border-white/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-[#0F0F1A]/50">Platforms</div>
                      <div className="text-sm font-medium text-[#0F0F1A]">20+</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="hidden lg:block absolute bottom-40 right-4 xl:right-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.4 }}
                  className="p-3 rounded-2xl bg-white/30 backdrop-blur-xl border border-white/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-[#0F0F1A]/50">Privacy</div>
                      <div className="text-sm font-medium text-[#0F0F1A]">100%</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Marquee */}
      <div className="w-full py-8 overflow-hidden border-y border-white/20">
        <div ref={marqueeRef} className="flex items-center gap-12 whitespace-nowrap w-max">
          {[...platforms, ...platforms].map((p, i) => (
            <span key={i} className="text-lg text-[#0F0F1A]/30 font-medium tracking-wide">{p}</span>
          ))}
        </div>
      </div>

      {/* Steps - Bento Grid */}
      <div ref={stepsRef} className="w-full max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/30 backdrop-blur-sm text-xs text-[#0F0F1A]/60 mb-4">Simple Process</span>
          <h2 className="text-4xl md:text-5xl font-normal text-[#0F0F1A]">Four Steps to Savings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="step-card group relative p-6 rounded-3xl bg-white/50 backdrop-blur-md border border-white/40 hover:bg-white/70 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-[#0F0F1A]/5 overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${step.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-[#0F0F1A]/40 font-medium tracking-widest uppercase">Step {step.num}</span>
                <h3 className="text-xl font-medium text-[#0F0F1A] mt-1 mb-2">{step.title}</h3>
                <p className="text-sm text-[#0F0F1A]/60 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features - Bento Layout */}
      <div ref={featuresRef} className="w-full max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/30 backdrop-blur-sm text-xs text-[#0F0F1A]/60 mb-4">Core Features</span>
          <h2 className="text-4xl md:text-5xl font-normal text-[#0F0F1A] mb-4">Everything You Need</h2>
          <p className="text-[#0F0F1A]/50 max-w-md mx-auto">One app replaces five. Shop smarter, not harder.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={`feature-item group p-6 rounded-3xl bg-gradient-to-br ${f.gradient} backdrop-blur-md border border-white/40 hover:border-white/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg`}>
                <div className="w-11 h-11 rounded-2xl bg-white/40 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-[#0F0F1A]" />
                </div>
                <h3 className="text-lg font-medium text-[#0F0F1A] mb-2">{f.title}</h3>
                <p className="text-sm text-[#0F0F1A]/60 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Social Proof */}
      <div className="w-full max-w-4xl mx-auto px-6 py-16">
        <div className="relative p-10 md:p-14 rounded-[2rem] bg-white/20 backdrop-blur-xl border border-white/30 text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-pink-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex justify-center mb-5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-[#0F0F1A] fill-[#0F0F1A]" />
              ))}
            </div>
            <p className="text-lg md:text-xl text-[#0F0F1A] leading-relaxed mb-8">
              "Saved ₹12,000 on my last wardrobe upgrade. One app, five platforms, zero effort."
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white font-medium text-sm">PS</div>
              <div className="text-left">
                <div className="text-sm font-medium text-[#0F0F1A]">Priya Sharma</div>
                <div className="text-xs text-[#0F0F1A]/50">Mumbai</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="w-full max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-normal text-[#0F0F1A] mb-4">Start Saving Today</h2>
        <p className="text-[#0F0F1A]/50 mb-8">Free forever. No credit card required.</p>
        <button
          onClick={() => navigate('/', { state: { scrollTo: 'early-join' } })}
          className="group inline-flex items-center gap-3 bg-[#0F0F1A] text-white px-10 py-4 rounded-full text-sm font-medium hover:bg-[#0F0F1A]/90 transition-all hover:gap-4"
        >
          Get Started
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}


