import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white/55 backdrop-blur-sm rounded-[2rem] border border-[#051F45]/10 shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#051F45]" style={{ fontFamily: 'Instrument Serif, serif' }}>
            Drip<span style={{ color: '#F2C4CD' }}>Feed</span>
          </h1>
          <p className="text-[#051F45]/60 text-sm mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#051F45] mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-[#051F45]/15 rounded-xl px-3 py-2.5 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#051F45]/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#051F45] mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-[#051F45]/15 rounded-xl px-3 py-2.5 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#051F45]/20"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#051F45] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#051F45]/90 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#051F45]/60 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#051F45] font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
