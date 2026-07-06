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
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
          <p className="text-[#051F45]/60 text-sm mt-1">Create your free account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#051F45] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-[#051F45]/15 rounded-xl px-3 py-2.5 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#051F45]/20"
              placeholder="Your name"
            />
          </div>
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
              placeholder="Min. 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#051F45] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#051F45]/90 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#051F45]/60 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-[#051F45] font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
