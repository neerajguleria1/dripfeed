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
    <div className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#051F45]/10 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 flex flex-col">
      <div className="relative aspect-square bg-[#F8F5F2] overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🛍️</div>
        )}
        <button
          onClick={handleSave}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
        >
          <Heart className={`w-4 h-4 ${saved ? 'fill-[#F2C4CD] text-[#F2C4CD]' : 'text-gray-400'}`} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        {product.brand && <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{product.brand}</p>}
        <p className="text-sm font-semibold text-navy line-clamp-2 leading-snug">{product.title}</p>
        <PlatformBadge platform={product.platform} />
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
        <div className="mt-auto pt-2 flex flex-col gap-1.5">
          <AffiliateButton platform={product.platform} url={product.url} productTitle={product.title} fullWidth />
          <button
            onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}
            className="w-full text-xs text-[#051F45]/70 hover:text-[#051F45] flex items-center justify-center gap-1 py-1"
          >
            <GitCompare className="w-3 h-3" /> Compare prices
          </button>
        </div>
      </div>
    </div>
  );
}
