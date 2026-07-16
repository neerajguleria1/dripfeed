import { MessageCircle, MapPin } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { formatINR } from '../../utils/format';

export interface ThriftCardProps {
  id: string;
  title: string;
  brand?: string;
  images: string[];
  price: number;
  condition: 'like-new' | 'good' | 'fair';
  city: string;
  size: string;
  whatsappNumber: string;
}

const conditionColors: Record<string, 'success' | 'warning' | 'default'> = {
  'like-new': 'success',
  good: 'warning',
  fair: 'default',
};

const conditionLabels: Record<string, string> = {
  'like-new': 'Like New',
  good: 'Good',
  fair: 'Fair',
};

export function ThriftCard({ title, brand, images, price, condition, city, size, whatsappNumber }: ThriftCardProps) {
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'm interested in "${title}" listed on TagCheck.`)}`;

  return (
    <Card variant="outlined" padding="none" hover className="overflow-hidden">
      {images.length > 0 ? (
        <img
          src={images[0]}
          alt={title}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-44 bg-gray-100 flex items-center justify-center text-3xl">👕</div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {brand && <p className="text-xs text-gray-400 uppercase tracking-wide">{brand}</p>}
            <p className="text-sm font-medium text-[#0F0F1A] line-clamp-2">{title}</p>
          </div>
          <Badge variant={conditionColors[condition]} size="sm">
            {conditionLabels[condition]}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-[#0F0F1A]">{formatINR(price)}</span>
          <span className="text-xs text-gray-400">Size {size}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-400">
          <MapPin className="w-3 h-3" /> {city}
        </div>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors mt-2"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp Seller
        </a>
      </div>
    </Card>
  );
}

export default ThriftCard;

