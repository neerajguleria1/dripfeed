import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { ProductVariants, VariantColor, VariantSize } from '../../../api/_lib/types/productVariant';

export interface VariantSelection {
  imageUrl: string;
  price: number;
  originalPrice: number | undefined;
  buyUrl: string;
}

interface Props {
  variants: ProductVariants | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  onSelect: (selection: VariantSelection) => void;
}

export function VariantPanel({ variants, status, onSelect }: Props) {
  const [selectedColor, setSelectedColor] = useState<VariantColor | null>(null);
  const [selectedSize, setSelectedSize] = useState<VariantSize | null>(null);

  useEffect(() => {
    if (variants && variants.colors.length > 0 && !selectedColor) {
      setSelectedColor(variants.colors[0]);
    }
  }, [variants, selectedColor]);

  useEffect(() => {
    if (!selectedColor) return;
    const base: VariantSelection = {
      imageUrl:      selectedColor.imageUrl,
      price:         selectedColor.price,
      originalPrice: selectedColor.originalPrice,
      buyUrl:        selectedColor.buyUrl,
    };
    if (selectedSize) {
      onSelect({
        imageUrl:      selectedSize.buyUrl ? selectedColor.imageUrl : selectedColor.imageUrl,
        price:         selectedSize.price || selectedColor.price,
        originalPrice: selectedSize.originalPrice || selectedColor.originalPrice,
        buyUrl:        selectedSize.buyUrl || selectedColor.buyUrl,
      });
    } else {
      onSelect(base);
    }
  }, [selectedColor, selectedSize]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-neutral-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[12px]">Loading variants…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 py-3 text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-[12px]">Couldn't load variants. Try again.</span>
      </div>
    );
  }

  if (status !== 'done' || !variants) return null;

  function handleColorClick(color: VariantColor) {
    setSelectedColor(color);
    setSelectedSize(null);
  }

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
      {variants.colors.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">
            Color
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variants.colors.map((color) => {
              const isSelected = selectedColor?.id === color.id;
              return (
                <button
                  key={color.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick(color); }}
                  title={color.name}
                  aria-label={color.name}
                  aria-pressed={isSelected}
                  className={[
                    'relative w-7 h-7 rounded-full border-2 transition-all duration-150 overflow-hidden flex-shrink-0',
                    isSelected
                      ? 'border-[#C9A96E] ring-2 ring-[#C9A96E]/30 scale-110'
                      : 'border-neutral-200 hover:border-neutral-400',
                    !color.available ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  {color.swatchUrl ? (
                    <img
                      src={color.swatchUrl}
                      alt={color.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-[8px] leading-none flex items-center justify-center w-full h-full text-neutral-500 font-medium">
                      {color.name.slice(0, 2)}
                    </span>
                  )}
                  {!color.available && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-full h-px bg-neutral-400 rotate-45 absolute" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedColor && (
            <p className="text-[11px] text-neutral-500 mt-1.5 capitalize">{selectedColor.name}</p>
          )}
        </div>
      )}

      {variants.sizes.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">
            Size {variants.sizes[0]?.format ? <span className="normal-case font-normal">({variants.sizes[0].format})</span> : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variants.sizes.map((size) => {
              const isSelected = selectedSize?.id === size.id;
              return (
                <button
                  key={size.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedSize(isSelected ? null : size); }}
                  aria-pressed={isSelected}
                  disabled={!size.available}
                  className={[
                    'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150',
                    isSelected
                      ? 'bg-[#171310] text-white border-[#171310]'
                      : size.available
                        ? 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        : 'bg-neutral-50 text-neutral-300 border-neutral-100 cursor-not-allowed line-through',
                  ].join(' ')}
                >
                  {size.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
