import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, MousePointerClick, Clock, ShoppingBag } from 'lucide-react';

interface PlatformStat { _id: string; clicks: number; }
interface RecentClick { platform: string; productTitle: string; device: string; createdAt: string; }
interface StatsData { total: number; byPlatform: PlatformStat[]; recent: RecentClick[]; }

const PLATFORM_COLORS: Record<string, string> = {
  myntra: '#FF3F6C', ajio: '#1A1A1A', amazon: '#FF9900',
  flipkart: '#2874F0', meesho: '#570741',
};

function color(platform: string) {
  return PLATFORM_COLORS[platform.toLowerCase()] || '#C9A96E';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ClickStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxClicks = data?.byPlatform[0]?.clicks || 1;

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-10 sm:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#C9A96E]" />
            <span className="text-[11px] font-semibold text-[#C9A96E] uppercase tracking-[0.08em]">Live Metrics</span>
          </div>
          <h1 className="text-[28px] sm:text-[36px] font-bold text-[#0F0F1A] tracking-[-0.02em]">
            TagCheck Click Analytics
          </h1>
          <p className="text-[14px] text-neutral-500 mt-1">
            Every "Buy Now" click tracked in real time across platforms.
          </p>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* Total clicks hero */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-neutral-100 p-8 flex items-center gap-6"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#C9A96E]/10 flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-6 h-6 text-[#C9A96E]" />
              </div>
              <div>
                <p className="text-[13px] text-neutral-400 font-medium">Total Buy Clicks</p>
                <p className="text-[42px] font-bold text-[#0F0F1A] leading-none tracking-[-0.02em] tabular-nums">
                  {data.total.toLocaleString('en-IN')}
                </p>
                <p className="text-[12px] text-neutral-400 mt-1">users clicked "Buy Now" from TagCheck</p>
              </div>
            </motion.div>

            {/* By platform */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-neutral-100 p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <ShoppingBag className="w-4 h-4 text-neutral-400" />
                <h2 className="text-[13px] font-semibold text-neutral-600 uppercase tracking-[0.06em]">Clicks by Platform</h2>
              </div>
              {data.byPlatform.length === 0 ? (
                <p className="text-[13px] text-neutral-400 py-4 text-center">No clicks yet — share the site to start tracking!</p>
              ) : (
                <div className="space-y-4">
                  {data.byPlatform.map((p) => (
                    <div key={p._id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-[#0F0F1A] capitalize">{p._id}</span>
                        <span className="text-[13px] font-bold tabular-nums text-[#0F0F1A]">{p.clicks.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(p.clicks / maxClicks) * 100}%` }}
                          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: color(p._id) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent clicks */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-neutral-100 p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-neutral-400" />
                <h2 className="text-[13px] font-semibold text-neutral-600 uppercase tracking-[0.06em]">Recent Activity</h2>
              </div>
              {data.recent.length === 0 ? (
                <p className="text-[13px] text-neutral-400 py-4 text-center">No activity yet.</p>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {data.recent.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color(c.platform) }}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#0F0F1A] truncate">{c.productTitle}</p>
                          <p className="text-[11px] text-neutral-400 capitalize">{c.platform} · {c.device}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-400 flex-shrink-0">{timeAgo(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <p className="text-center text-[11px] text-neutral-400 pb-6">
              Data updates live · Every click = a real user intent to purchase
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
