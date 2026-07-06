import { Eye, Heart } from 'lucide-react';

export interface SocialProofProps {
  compareCount?: number;
  saveCount?: number;
  className?: string;
}

export function SocialProof({ compareCount, saveCount, className = '' }: SocialProofProps) {
  const hasCompare = compareCount != null && compareCount > 0;
  const hasSave = saveCount != null && saveCount > 0;

  if (!hasCompare && !hasSave) return null;

  return (
    <div
      className={[
        'flex items-center gap-3 text-xs text-gray-500',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasCompare && (
        <span className="flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          {compareCount} compared today
        </span>
      )}
      {hasCompare && hasSave && (
        <span className="w-px h-3 bg-gray-300" aria-hidden="true" />
      )}
      {hasSave && (
        <span className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          {saveCount} saved
        </span>
      )}
    </div>
  );
}

export default SocialProof;
