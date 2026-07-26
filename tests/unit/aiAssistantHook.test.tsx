/**
 * tests/unit/aiAssistantHook.test.tsx
 *
 * React hook tests for useAiAssistant.
 * Must be .tsx to get jsdom environment via vitest.config.ts environmentMatchGlobs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAiAssistant, _moduleCache } from '../../src/hooks/useAiAssistant';

vi.mock('../../src/services/api', () => ({
  default: { post: vi.fn() },
}));

import api from '../../src/services/api';
const mockApi = api.post as ReturnType<typeof vi.fn>;

const MOCK_RESPONSE = {
  verdict:      'buy_now' as const,
  summary:      'Amazon has the best price.',
  insights:     [],
  bestRetailer: 'Amazon',
  generatedAt:  Date.now(),
  provider:     'groq',
  cached:       false,
};

describe('useAiAssistant hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _moduleCache.clear();
  });

  it('starts in idle status', () => {
    const { result } = renderHook(() => useAiAssistant());
    expect(result.current.status).toBe('idle');
    expect(result.current.response).toBeNull();
  });

  it('transitions to loading then success', async () => {
    mockApi.mockResolvedValueOnce({ data: MOCK_RESPONSE });
    const { result } = renderHook(() => useAiAssistant());

    act(() => { result.current.fetch('az_B0TEST'); });
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.verdict).toBe('buy_now');
  });

  it('transitions to error on API failure', async () => {
    mockApi.mockRejectedValueOnce({ response: { data: { error: 'Not found' } }, message: 'Network error' });
    const { result } = renderHook(() => useAiAssistant());

    await act(async () => { await result.current.fetch('az_B0TEST'); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('uses module-level cache on second fetch — does not call API twice', async () => {
    mockApi.mockResolvedValueOnce({ data: MOCK_RESPONSE });
    const { result } = renderHook(() => useAiAssistant());

    await act(async () => { await result.current.fetch('az_B0TEST'); });
    expect(result.current.status).toBe('success');
    expect(mockApi).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.fetch('az_B0TEST'); });
    // module cache hit — API must NOT be called again
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('regenerate busts the cache and calls API again', async () => {
    mockApi.mockResolvedValue({ data: MOCK_RESPONSE });
    const { result } = renderHook(() => useAiAssistant());

    await act(async () => { await result.current.fetch('az_B0TEST'); });
    await act(async () => { await result.current.regenerate('az_B0TEST'); });

    expect(mockApi).toHaveBeenCalledTimes(2);
  });
});
