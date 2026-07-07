import { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Check, Send, Zap, Crown, Gift } from 'lucide-react';

const perks = [
  { icon: Zap, text: 'Early access to all features before the public launch' },
  { icon: Crown, text: 'Exclusive launch perks and special pricing' },
  { icon: Gift, text: 'Shape the product with your feedback and suggestions' },
];

export default function EarlyJoin() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', review: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const perksRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const checkmarkRef = useRef<HTMLDivElement>(null);

  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyt9e_YvNM3EtMh93zgRsPLioOFBp9JNPHr766CyPZtfr4vdfxOizFEiUQTWMJo7EeM/exec';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      await fetch(SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...form, phone: `+91${form.phone}` }),
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Waitlist error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [form]);

  // Mount animations
  useGSAP(() => {
    gsap.from(heroRef.current, {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power3.out',
    });

    // Staggered perks
    const perkItems = perksRef.current?.querySelectorAll('.perk-item');
    if (perkItems?.length) {
      gsap.from(perkItems, {
        opacity: 0,
        x: -20,
        stagger: 0.1,
        duration: 0.4,
        ease: 'power3.out',
        delay: 0.3,
      });
    }

    // Form slide-in
    gsap.from(formRef.current, {
      opacity: 0,
      x: 20,
      duration: 0.5,
      ease: 'power3.out',
      delay: 0.4,
    });
  }, { scope: pageRef });

  // Success state animation
  useGSAP(() => {
    if (submitted && successRef.current) {
      gsap.from(successRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.4,
        ease: 'power2.out',
      });

      // Spring-like bounce for checkmark
      if (checkmarkRef.current) {
        gsap.from(checkmarkRef.current, {
          scale: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)',
          delay: 0.1,
        });
      }
    }
  }, { scope: pageRef, dependencies: [submitted] });

  return (
    <div ref={pageRef} className="text-[#0F0F1A] flex flex-col relative overflow-hidden">
      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-24">
        <div ref={heroRef} className="w-full max-w-4xl">
          {submitted ? (
            /* ── Success State ── */
            <div ref={successRef} className="text-center max-w-lg mx-auto">
              <div
                ref={checkmarkRef}
                className="w-16 h-16 rounded-full bg-[#C9A96E]/10 flex items-center justify-center mx-auto mb-6"
              >
                <Check className="w-7 h-7 text-[#0F0F1A]" />
              </div>

              {/* Decorative rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 rounded-full border border-[#C9A96E]/5 animate-ping" style={{ animationDuration: '3s' }} />
              </div>

              <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] leading-[0.9] mb-3 text-[#0F0F1A]">
                You're on the List
              </h1>
              <p className="text-[#0F0F1A] text-sm sm:text-base max-w-sm mx-auto">
                Thanks for your interest. We'll keep you posted on the launch and send early access details straight to your inbox.
              </p>
              <button
                onClick={() => document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 mt-8 bg-[#C9A96E] text-black rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:gap-3 cursor-pointer"
              >
                Back Home
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
              {/* Perks - left side */}
              <div ref={perksRef} className="lg:col-span-2 pt-2">
                <span className="inline-block px-3 py-1 rounded-full border border-[#0F0F1A]/10 bg-white/60 text-[10px] font-mono tracking-[0.2em] uppercase text-[#0F0F1A] mb-4">
                  Why Join Early?
                </span>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] leading-[1.1] mb-4 text-[#0F0F1A]">
                  Be the First to Experience DripFeed
                </h2>
                <p className="text-[#0F0F1A] text-sm leading-relaxed mb-6">
                  Early joiners get exclusive access, special perks, and a direct line to shape the product.
                </p>
                <div className="space-y-4">
                  {perks.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div
                        key={p.text}
                        className="perk-item flex items-start gap-3"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/15 shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-[#0F0F1A]" />
                        </div>
                        <p className="text-[#0F0F1A] text-sm">{p.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form - right side */}
              <div ref={formRef} className="lg:col-span-3">
                <div className="rounded-2xl border border-[#0F0F1A]/10 bg-white/40 backdrop-blur-sm p-6 md:p-8 relative">
                  {/* Top accent */}
                  <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/20 to-transparent" />

                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-[#0F0F1A]">Join the Waitlist</h3>
                    <p className="text-[#0F0F1A] text-xs mt-1">Drop your details and we'll reach out.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-[11px] font-mono tracking-wider text-[#0F0F1A] uppercase mb-1.5">
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your full name"
                        className="w-full bg-white/80 border border-[#0F0F1A]/20 rounded-xl px-4 py-3 text-sm text-[#0F0F1A] placeholder:text-[#0F0F1A]/40 outline-none focus:border-[#C9A96E]/50 focus:bg-white transition-all duration-300"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-[11px] font-mono tracking-wider text-[#0F0F1A] uppercase mb-1.5">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="w-full bg-white/80 border border-[#0F0F1A]/20 rounded-xl px-4 py-3 text-sm text-[#0F0F1A] placeholder:text-[#0F0F1A]/40 outline-none focus:border-[#C9A96E]/50 focus:bg-white transition-all duration-300"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label htmlFor="phone" className="block text-[11px] font-mono tracking-wider text-[#0F0F1A] uppercase mb-1.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0F0F1A] text-sm font-mono pointer-events-none">+91</span>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          required
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="98765 43210"
                          className="w-full bg-white/80 border border-[#0F0F1A]/20 rounded-xl pl-12 pr-4 py-3 text-sm text-[#0F0F1A] placeholder:text-[#0F0F1A]/40 outline-none focus:border-[#C9A96E]/50 focus:bg-white transition-all duration-300"
                        />
                      </div>
                    </div>

                    {/* Review / Feedback */}
                    <div>
                      <label htmlFor="review" className="block text-[11px] font-mono tracking-wider text-[#0F0F1A] uppercase mb-1.5">
                        Review / Feedback
                      </label>
                      <textarea
                        id="review"
                        name="review"
                        rows={3}
                        value={form.review}
                        onChange={handleChange}
                        placeholder="What features would you like to see? Any feedback?"
                        className="w-full bg-white/80 border border-[#0F0F1A]/20 rounded-xl px-4 py-3 text-sm text-[#0F0F1A] placeholder:text-[#0F0F1A]/40 outline-none focus:border-[#C9A96E]/50 focus:bg-white transition-all duration-300 resize-none"
                      />
                    </div>

                    {/* Trust badges */}
                    {error && (
                      <p className="text-red-500/80 text-xs text-center">{error}</p>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full group inline-flex items-center justify-center gap-2 bg-[#C9A96E] text-black rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 hover:gap-3 hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Join the Waitlist</span>
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


