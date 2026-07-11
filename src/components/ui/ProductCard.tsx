import { useState } from 'react';
import { Heart, GitCompare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PriceDisplay from './PriceDisplay';
import PlatformBadge from './PlatformBadge';
import AffiliateButton from './AffiliateButton';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface Product {
  title: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  platform: string;
  url: string;
  imageUrl?: string;
}

export default function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    if (saved || saving) return;
    setSaving(true);
    try {
      await api.post('/wishlist', {
        productTitle: product.title,
        imageUrl: product.imageUrl,
        brand: product.brand,
        lowestPrice: product.price,
        lowestPlatform: product.platform,
        sourceUrl: product.url,
      });
      setSaved(true);
    } catch { /* already saved */ }
    finally { setSaving(false); }
  }

  return (
    <div
      onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/compare?q=${encodeURIComponent(product.title)}`); } }}
      className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#0F0F1A]/10 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
    >      <div className="relative aspect-square bg-[#F8F5F2] overflow-hidden">
        {product.imageUrl && !product.imageUrl.includes('placehold.co') ? (
          <>
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-full items-center justify-center absolute inset-0 bg-[#F8F5F2]" style={{ display: 'none' }}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">🛍️</span>
                <span className="text-[10px] text-gray-400 font-medium">{product.brand || product.title.slice(0, 20)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl">🛍️</span>
              <span className="text-[10px] text-gray-400 font-medium">{product.brand || product.title.slice(0, 20)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleSave}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
        >
          <Heart className={`w-4 h-4 ${saved ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-gray-400'}`} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1 overflow-hidden min-w-0">
        {product.brand && <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{product.brand}</p>}
        <p className="text-sm font-semibold text-navy line-clamp-2 leading-snug">{product.title}</p>
        <PlatformBadge platform={product.platform} />
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
        <div className="mt-auto pt-2 flex flex-col gap-1.5">
          <AffiliateButton platform={product.platform} url={product.url} productTitle={product.title} fullWidth />
          <button
            onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}
            className="w-full text-xs text-[#0F0F1A]/70 hover:text-[#0F0F1A] flex items-center justify-center gap-1 py-1"
          >
            <GitCompare className="w-3 h-3" /> Compare prices
          </button>
        </div>
      </div>
    </div>
  );
}


