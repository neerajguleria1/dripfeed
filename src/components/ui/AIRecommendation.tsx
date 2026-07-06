import { useState, useEffect } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface Props {
  productTitle: string;
  platforms: any[];
}

export default function AIRecommendation({ productTitle, platforms }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productTitle || !platforms.length) return;

    setLoading(true);
    setError(false);

    api.post('/products/ai-recommend', { productTitle, platforms })
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [productTitle, platforms]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 mt-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
        <p className="text-sm text-purple-700">AI is analyzing prices and generating a recommendation...</p>
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-[#051F45] text-sm">AI Shopping Advisor</h3>
      </div>

      {data.summary && (
        <p className="text-sm text-gray-700 mb-3">{data.summary}</p>
      )}

      {data.recommendation && (
        <div className="bg-white/70 rounded-xl p-3 mb-3 border border-purple-100">
          <p className="text-sm font-medium text-[#051F45]">💡 {data.recommendation}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.pros?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" /> Pros
            </p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {data.pros.map((p: string, i: number) => (
                <li key={i}>✓ {p}</li>
              ))}
            </ul>
          </div>
        )}
        {data.cons?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
              <ThumbsDown className="w-3 h-3" /> Cons
            </p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {data.cons.map((c: string, i: number) => (
                <li key={i}>✗ {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
