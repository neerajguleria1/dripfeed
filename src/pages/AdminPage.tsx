import { useState, useEffect } from 'react';
import { Users, MousePointerClick, TrendingUp, IndianRupee } from 'lucide-react';
import api from '../services/api';
import { formatINR } from '../utils/format';

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: any; sub?: string }) {
  return (
    <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-[#F8F5F2] rounded-xl flex items-center justify-center">{icon}</div>
        <p className="text-sm text-[#0F0F1A]/60">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[#0F0F1A]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [affiliateStats, setAffiliateStats] = useState<{ platforms: { platform: string; clicks: number }[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/users'), api.get('/admin/affiliate-stats')])
      .then(([s, u, a]) => {
        setStats(s.data.stats || s.data);
        setUsers(u.data.users || []);
        setAffiliateStats(a.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[#0F0F1A] mb-6" style={{ fontFamily: 'Instrument Serif, serif' }}>Admin Dashboard</h1>

      <div className="flex gap-2 mb-6 border-b border-[#0F0F1A]/10">
        {['overview', 'affiliate', 'users'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[#0F0F1A] text-[#0F0F1A]' : 'border-transparent text-[#0F0F1A]/50 hover:text-[#0F0F1A]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users className="w-5 h-5 text-[#0F0F1A]" />} label="Total Users" value={stats.users ?? '—'} />
            <StatCard icon={<MousePointerClick className="w-5 h-5 text-[#0F0F1A]" />} label="Total Products" value={stats.products ?? '—'} />
            <StatCard icon={<IndianRupee className="w-5 h-5 text-[#0F0F1A]" />} label="Revenue" value={formatINR(stats.revenue)} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-[#0F0F1A]" />} label="Total Orders" value={stats.orders ?? '—'} />
          </div>

        </>
      )}

      {tab === 'affiliate' && affiliateStats && (
        <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
          <h2 className="font-semibold text-[#0F0F1A] mb-1">Affiliate Clicks by Platform</h2>
          <p className="text-xs text-[#0F0F1A]/40 mb-4">{affiliateStats.total} total clicks</p>
          {affiliateStats.platforms.length === 0 ? (
            <p className="text-sm text-[#0F0F1A]/50">No clicks recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {affiliateStats.platforms.map(p => (
                <div key={p.platform} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium text-[#0F0F1A] capitalize">{p.platform}</span>
                  <div className="flex-1 bg-[#F8F5F2] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-[#0F0F1A] rounded-full"
                      style={{ width: `${Math.round((p.clicks / affiliateStats.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-[#0F0F1A]/60 w-10 text-right">{p.clicks}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'affiliate' && !affiliateStats && (
        <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
          <p className="text-sm text-[#0F0F1A]/50">Loading affiliate stats…</p>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
          <h2 className="font-semibold text-[#0F0F1A] mb-4">Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#0F0F1A]/40 border-b border-[#0F0F1A]/10">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-[#0F0F1A]/5 last:border-0">
                    <td className="py-2 text-[#0F0F1A]">{u.name}</td>
                    <td className="py-2 text-[#0F0F1A]/70">{u.email}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-[#0F0F1A] text-white' : 'bg-[#F8F5F2] text-[#0F0F1A]/70'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 text-[#0F0F1A]/40">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

