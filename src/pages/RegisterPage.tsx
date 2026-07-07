import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#0F0F1A] via-[#1A1A2E] to-[#0F0F1A]">
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] p-8 w-full max-w-sm border border-neutral-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>
            <span className="text-[#0F0F1A]">Drip</span><span className="text-[#C9A96E]">Feed</span>
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Create your free account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0F0F1A] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all min-h-[44px]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F0F1A] mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all min-h-[44px]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F0F1A] mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all min-h-[44px]"
              placeholder="Min. 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#C9A96E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#B8964F] disabled:opacity-60 transition-colors min-h-[44px]"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-[#C9A96E] font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
