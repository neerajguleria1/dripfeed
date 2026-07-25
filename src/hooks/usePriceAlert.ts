/**
 * usePriceAlert.ts
 *
 * Manages price alert state for a single canonical product.
 * Checks existing alert status on mount, exposes create/cancel actions.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export type AlertStatus = 'active' | 'triggered' | 'cancelled' | 'expired';

export interface AlertState {
  status: AlertStatus;
  targetPrice: number;
  triggeredAt?: string;
  createdAt?: string;
}

export type HookStatus = 'idle' | 'loading' | 'none' | 'watching' | 'triggered' | 'error';

interface UsePriceAlertReturn {
  hookStatus: HookStatus;
  alert: AlertState | null;
  create: (params: CreateParams) => Promise<void>;
  cancel: () => Promise<void>;
  error: string | null;
}

interface CreateParams {
  targetPrice: number;
  currentPrice: number;
  productTitle: string;
  sessionId: string;
  email?: string;
  platform?: string;
  imageUrl?: string;
}

function getSessionId(): string {
  try {
    const key = 'tc_sid';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function usePriceAlert(canonicalId: string | undefined): UsePriceAlertReturn {
  const [hookStatus, setHookStatus] = useState<HookStatus>('idle');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check existing alert on mount
  useEffect(() => {
    if (!canonicalId) return;
    const sid = getSessionId();
    setHookStatus('loading');
    api.get(`/alerts/status?canonicalId=${encodeURIComponent(canonicalId)}&sessionId=${encodeURIComponent(sid)}`)
      .then(({ data }) => {
        if (data.alert) {
          setAlert(data.alert);
          setHookStatus(data.alert.status === 'active' ? 'watching' : data.alert.status === 'triggered' ? 'triggered' : 'none');
        } else {
          setHookStatus('none');
        }
      })
      .catch(() => setHookStatus('none'));
  }, [canonicalId]);

  const create = useCallback(async (params: CreateParams) => {
    if (!canonicalId) return;
    setError(null);
    try {
      const { data } = await api.post('/alerts/create', {
        canonicalId,
        ...params,
        sessionId: params.sessionId || getSessionId(),
      });
      setAlert(data.alert);
      setHookStatus('watching');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'Failed to create alert';
      setError(msg);
      if (e?.response?.status === 409) {
        setHookStatus('watching');
      }
      throw e;
    }
  }, [canonicalId]);

  const cancel = useCallback(async () => {
    if (!canonicalId) return;
    const sid = getSessionId();
    try {
      await api.post('/alerts/cancel', { canonicalId, sessionId: sid });
      setAlert(null);
      setHookStatus('none');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to cancel alert');
    }
  }, [canonicalId]);

  return { hookStatus, alert, create, cancel, error };
}

export { getSessionId };
