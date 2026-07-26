/**
 * PriceAlertModal.tsx
 *
 * Modal for creating/viewing a price alert.
 * Reuses existing Modal, no new dependencies.
 * Full keyboard support + focus trap via existing Modal component.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatPrice } from '../../utils/formatPrice';
import Analytics from '../../utils/analytics';
import { usePriceAlert, getSessionId } from '../../hooks/usePriceAlert';

interface PriceAlertModalProps {
  open: boolean;
  onClose: () => void;
  canonicalId: string;
  currentPrice: number;
  productTitle: string;
  platform?: string;
  imageUrl?: string;
}

export function PriceAlertModal({
  open,
  onClose,
  canonicalId,
  currentPrice,
  productTitle,
  platform,
  imageUrl,
}: PriceAlertModalProps) {
  const { hookStatus, alert, create, cancel, error } = usePriceAlert(canonicalId);

  const [targetInput, setTargetInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open && hookStatus === 'none') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, hookStatus]);

  // Track modal open
  useEffect(() => {
    if (open && canonicalId) Analytics.alertOpened(canonicalId, productTitle);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetPrice = parseFloat(targetInput);
  const savings = currentPrice - targetPrice;
  const savingsPct = currentPrice > 0 && savings > 0
    ? Math.round((savings / currentPrice) * 100)
    : 0;

  function validate(): boolean {
    if (!targetInput || isNaN(targetPrice) || targetPrice <= 0) {
      setValidationError('Enter a valid target price');
      return false;
    }
    if (targetPrice >= currentPrice) {
      setValidationError(`Target must be below current price (${formatPrice(currentPrice)})`);
      return false;
    }
    if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setValidationError('Enter a valid email or leave it blank');
      return false;
    }
    setValidationError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await create({
        targetPrice,
        currentPrice,
        productTitle,
        sessionId: getSessionId(),
        email: emailInput.trim() || undefined,
        platform,
        imageUrl,
      });
      Analytics.alertCreated(canonicalId, productTitle, targetPrice);
    } catch {
      // error already set in hook
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    await cancel();
    Analytics.alertCancelled(canonicalId, productTitle);
  }

  // ── Triggered state ──────────────────────────────────────────────────────

  if (hookStatus === 'triggered') {
    return (
      <Modal open={open} onClose={onClose} title="Alert Triggered!" size="sm">
        <div className="text-center py-2">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" aria-hidden="true" />
          <p className="text-[14px] text-neutral-600 mb-1">
            <strong>{productTitle}</strong> dropped to your target price!
          </p>
          {alert?.targetPrice && (
            <p className="text-[13px] text-neutral-400">
              Target: {formatPrice(alert.targetPrice)}
            </p>
          )}
          <button
            onClick={onClose}
            className="mt-5 w-full bg-[#0F0F1A] text-white font-medium py-2.5 rounded-full text-[13px] min-h-[44px] hover:bg-[#1A1A2E] transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // ── Already watching state ───────────────────────────────────────────────

  if (hookStatus === 'watching') {
    return (
      <Modal open={open} onClose={onClose} title="Price Alert Active" size="sm">
        <div className="text-center py-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-amber-500" aria-hidden="true" />
          </div>
          <p className="text-[14px] text-neutral-700 font-medium mb-1">Watching this product</p>
          {alert?.targetPrice && (
            <p className="text-[13px] text-neutral-500 mb-4">
              You'll be notified when price drops to{' '}
              <strong className="text-[#0F0F1A]">{formatPrice(alert.targetPrice)}</strong>
            </p>
          )}
          <button
            onClick={handleCancel}
            className="w-full flex items-center justify-center gap-2 border border-neutral-200 text-neutral-600 font-medium py-2.5 rounded-full text-[13px] min-h-[44px] hover:border-red-300 hover:text-red-500 transition-colors"
            aria-label="Cancel price alert"
          >
            <BellOff className="w-4 h-4" aria-hidden="true" />
            Cancel Alert
          </button>
        </div>
      </Modal>
    );
  }

  // ── Create alert form ────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} title="Set Price Alert" size="sm">
      <form onSubmit={handleSubmit} noValidate>
        {/* Current price context */}
        <div className="bg-neutral-50 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-[12px] text-neutral-500">Current price</span>
          <span className="text-[16px] font-bold text-[#0F0F1A] tabular-nums">
            {formatPrice(currentPrice)}
          </span>
        </div>

        {/* Target price input */}
        <div className="mb-3">
          <label
            htmlFor="alert-target-price"
            className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-[0.08em] mb-1.5"
          >
            Notify me when price drops to
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[14px] font-medium pointer-events-none">
              ₹
            </span>
            <input
              ref={inputRef}
              id="alert-target-price"
              type="number"
              inputMode="numeric"
              min={1}
              max={currentPrice - 1}
              value={targetInput}
              onChange={e => { setTargetInput(e.target.value); setValidationError(''); }}
              placeholder={String(Math.round(currentPrice * 0.9))}
              className="w-full h-11 pl-7 pr-4 rounded-xl border border-neutral-200 text-[15px] font-semibold text-[#0F0F1A] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all"
              aria-describedby={validationError ? 'alert-price-error' : undefined}
              aria-invalid={!!validationError}
            />
          </div>
          {validationError && (
            <p id="alert-price-error" role="alert" className="mt-1 text-[12px] text-red-500">
              {validationError}
            </p>
          )}
        </div>

        {/* Estimated savings */}
        {targetInput && !isNaN(targetPrice) && targetPrice > 0 && targetPrice < currentPrice && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
            <span className="text-[12px] text-emerald-700">Estimated savings</span>
            <span className="text-[13px] font-semibold text-emerald-700">
              {formatPrice(savings)} ({savingsPct}% off)
            </span>
          </div>
        )}

        {/* Optional email */}
        <div className="mb-4">
          <label
            htmlFor="alert-email"
            className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-[0.08em] mb-1.5"
          >
            Email (optional)
          </label>
          <input
            id="alert-email"
            type="email"
            inputMode="email"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setValidationError(''); }}
            placeholder="you@example.com"
            className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-[14px] text-[#0F0F1A] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            We'll email you when the price drops. No spam, ever.
          </p>
        </div>

        {/* Server error */}
        {error && !validationError && (
          <p role="alert" className="mb-3 text-[12px] text-red-500 text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || hookStatus === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-[#0F0F1A] text-white font-semibold py-3 rounded-full text-[13px] min-h-[44px] hover:bg-[#1A1A2E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-busy={submitting}
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Setting alert…</>
            : <><Bell className="w-4 h-4" aria-hidden="true" /> Notify Me</>}
        </button>
      </form>
    </Modal>
  );
}
