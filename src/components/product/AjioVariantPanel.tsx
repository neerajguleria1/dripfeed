import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { AjioProductVariants, AjioColorVariant, AjioSizeVariant } from '../../../api/_lib/types/productVariant';

export interface VariantSelection {
  imageUrl: string;
  price: number;
  originalPrice: number | undefined;
  buyUrl: string;
}

interface Props {
  variants: AjioProductVariants | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  onSelect: (selection: VariantSelection) => void;
}

export function AjioVariantPanel({ variants, status, onSelect }: Props) {
  const [selectedColor, setSelectedColor] = useState<AjioColorVariant | null>(null);
  const [selectedSize, setSelectedSize] = useState<AjioSizeVariant | null>(null);

  // Auto-select first color when variants load
  useEffect(() => {
    if (variants && variants.colors.length > 0 && !selectedColor) {
      setSelectedColor(variants.colors[0]);
    }
  }, [variants, selectedColor]);

  // Notify parent whenever color or size selection changes
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
        imageUrl:      selectedSize.imageUrl || selectedColor.imageUrl,
        price:         selectedSize.price,
        originalPrice: selectedSize.originalPrice,
        buyUrl:        selectedSize.buyUrl,
      });
    } else {
      onSelect(base);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleColorClick(color: AjioColorVariant) {
    setSelectedColor(color);
    setSelectedSize(null); // reset size when color changes
  }

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
      {/* Colors */}
      {variants.colors.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">
            Color
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variants.colors.map((color) => {
              const isSelected = selectedColor?.colorCode === color.colorCode;
              return (
                <button
                  key={color.colorCode}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick(color); }}
                  title={color.colorName}
                  aria-label={color.colorName}
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
                      alt={color.colorName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-[8px] leading-none flex items-center justify-center w-full h-full text-neutral-500 font-medium">
                      {color.colorName.slice(0, 2)}
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
            <p className="text-[11px] text-neutral-500 mt-1.5 capitalize">{selectedColor.colorName}</p>
          )}
        </div>
      )}

      {/* Sizes — scoped to selected color */}
      {variants.sizes.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">
            Size <span className="normal-case font-normal">({variants.sizes[0]?.sizeFormat})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variants.sizes.map((size) => {
              const isSelected = selectedSize?.skuCode === size.skuCode;
              return (
                <button
                  key={size.skuCode}
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
                  {size.sizeLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
