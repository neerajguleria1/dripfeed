import { useState, useEffect } from 'react';
import { Users, MousePointerClick, TrendingUp, IndianRupee, BarChart2, Search, ShoppingBag, Bell } from 'lucide-react';
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
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [alertsData, setAlertsData] = useState<any>(null);
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

  useEffect(() => {
    if (tab !== 'analytics') return;
    api.get(`/analytics/dashboard?days=${analyticsDays}`)
      .then(({ data }) => setAnalyticsData(data))
      .catch(() => {});
  }, [tab, analyticsDays]);

  useEffect(() => {
    if (tab !== 'alerts') return;
    api.get('/alerts/dashboard')
      .then(({ data }) => setAlertsData(data))
      .catch(() => {});
  }, [tab]);

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
        {['overview', 'analytics', 'alerts', 'affiliate', 'users'].map(t => (
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

      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setAnalyticsDays(d)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  analyticsDays === d ? 'bg-[#0F0F1A] text-white' : 'bg-[#F8F5F2] text-[#0F0F1A]/60 hover:bg-[#0F0F1A]/10'
                }`}>
                {d}d
              </button>
            ))}
          </div>

          {!analyticsData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-white/55 rounded-2xl border border-[#0F0F1A]/10" />)}
            </div>
          )}

          {analyticsData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Search className="w-5 h-5 text-[#0F0F1A]" />} label="Searches" value={analyticsData.summary.totalSearches ?? 0} sub={`${analyticsData.summary.searchSuccessRate ?? 0}% success rate`} />
                <StatCard icon={<ShoppingBag className="w-5 h-5 text-[#0F0F1A]" />} label="Product Views" value={analyticsData.summary.totalProductViews ?? 0} />
                <StatCard icon={<MousePointerClick className="w-5 h-5 text-[#0F0F1A]" />} label="Affiliate Clicks" value={analyticsData.summary.totalAffiliateClicks ?? 0} sub={`CTR ${analyticsData.summary.ctr ?? 0}%`} />
                <StatCard icon={<BarChart2 className="w-5 h-5 text-[#0F0F1A]" />} label="Rec CTR" value={`${analyticsData.summary.recCtr ?? 0}%`} sub={`Avg latency ${analyticsData.summary.avgSearchLatencyMs ?? '—'}ms`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Searches */}
                <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
                  <h2 className="font-semibold text-[#0F0F1A] mb-4">Top Searches</h2>
                  {analyticsData.topSearches.length === 0
                    ? <p className="text-sm text-[#0F0F1A]/40">No data yet</p>
                    : analyticsData.topSearches.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#0F0F1A]/5 last:border-0">
                        <span className="text-sm text-[#0F0F1A] capitalize">{s.query}</span>
                        <span className="text-sm font-semibold text-[#0F0F1A]/60">{s.count}</span>
                      </div>
                    ))}
                </div>

                {/* Top Products */}
                <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
                  <h2 className="font-semibold text-[#0F0F1A] mb-4">Top Products</h2>
                  {analyticsData.topProducts.length === 0
                    ? <p className="text-sm text-[#0F0F1A]/40">No data yet</p>
                    : analyticsData.topProducts.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#0F0F1A]/5 last:border-0">
                        <span className="text-sm text-[#0F0F1A] line-clamp-1 flex-1 mr-2">{p.title}</span>
                        <span className="text-sm font-semibold text-[#0F0F1A]/60 flex-shrink-0">{p.views} views</span>
                      </div>
                    ))}
                </div>

                {/* Most Clicked Retailers */}
                <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
                  <h2 className="font-semibold text-[#0F0F1A] mb-4">Most Clicked Retailers</h2>
                  {analyticsData.topPlatforms.length === 0
                    ? <p className="text-sm text-[#0F0F1A]/40">No data yet</p>
                    : analyticsData.topPlatforms.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[#0F0F1A]/5 last:border-0">
                        <span className="w-20 text-sm font-medium text-[#0F0F1A] capitalize">{p.platform}</span>
                        <div className="flex-1 bg-[#F8F5F2] rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 bg-[#0F0F1A] rounded-full"
                            style={{ width: `${Math.round((p.clicks / (analyticsData.topPlatforms[0]?.clicks || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-sm text-[#0F0F1A]/60 w-8 text-right">{p.clicks}</span>
                      </div>
                    ))}
                </div>

                {/* No Result Searches */}
                <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
                  <h2 className="font-semibold text-[#0F0F1A] mb-1">No-Result Searches</h2>
                  <p className="text-xs text-[#0F0F1A]/40 mb-4">{analyticsData.summary.noResultSearchCount} total</p>
                  {analyticsData.noResultSearches.length === 0
                    ? <p className="text-sm text-[#0F0F1A]/40">None — great coverage!</p>
                    : analyticsData.noResultSearches.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#0F0F1A]/5 last:border-0">
                        <span className="text-sm text-[#0F0F1A] capitalize">{s.query}</span>
                        <span className="text-sm font-semibold text-red-400">{s.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users className="w-5 h-5 text-[#0F0F1A]" />} label="Total Users" value={stats.users ?? '—'} />
            <StatCard icon={<MousePointerClick className="w-5 h-5 text-[#0F0F1A]" />} label="Total Products" value={stats.products ?? '—'} />
            <StatCard icon={<IndianRupee className="w-5 h-5 text-[#0F0F1A]" />} label="Revenue" value={formatINR(stats.revenue)} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-[#0F0F1A]" />} label="Total Orders" value={stats.orders ?? '—'} />
          </div>

        </>
      )}

      {tab === 'alerts' && (
        <div className="space-y-6">
          {!alertsData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-white/55 rounded-2xl border border-[#0F0F1A]/10" />)}
            </div>
          )}
          {alertsData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Bell className="w-5 h-5 text-[#0F0F1A]" />} label="Total Alerts" value={alertsData.total ?? 0} />
                <StatCard icon={<Bell className="w-5 h-5 text-amber-500" />} label="Active" value={alertsData.active ?? 0} />
                <StatCard icon={<Bell className="w-5 h-5 text-emerald-500" />} label="Triggered" value={alertsData.triggered ?? 0} sub={`${alertsData.conversionRate ?? 0}% conversion`} />
                <StatCard icon={<TrendingUp className="w-5 h-5 text-[#0F0F1A]" />} label="Avg Target Discount" value={`${alertsData.avgTargetDiscount ?? 0}%`} />
              </div>
              <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 p-5">
                <h2 className="font-semibold text-[#0F0F1A] mb-4">Top Alerted Products</h2>
                {alertsData.topAlertedProducts?.length === 0
                  ? <p className="text-sm text-[#0F0F1A]/40">No alerts yet</p>
                  : alertsData.topAlertedProducts?.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#0F0F1A]/5 last:border-0">
                      <span className="text-sm text-[#0F0F1A] line-clamp-1 flex-1 mr-2">{p.productTitle}</span>
                      <span className="text-sm font-semibold text-[#0F0F1A]/60 flex-shrink-0">{p.count} alerts</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
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

