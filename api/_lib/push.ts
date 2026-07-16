import webpush from 'web-push';
import { PushSubscription } from './models/PushSubscription.js';

// Strip BOM / zero-width characters that can sneak into env vars depending
// on how the value was set (e.g. piping through certain shells).
function cleanEnvValue(value: string | undefined): string | undefined {
  return value?.replace(/^\uFEFF/, '').trim() || undefined;
}

const VAPID_PUBLIC_KEY = cleanEnvValue(process.env.VAPID_PUBLIC_KEY);
const VAPID_PRIVATE_KEY = cleanEnvValue(process.env.VAPID_PRIVATE_KEY);
const VAPID_SUBJECT = cleanEnvValue(process.env.VAPID_SUBJECT) || 'mailto:neerajworking51@gmail.com';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Sends a push notification to every subscription belonging to a user.
 * Silently removes subscriptions that are no longer valid (410/404 from the
 * push service — happens when the user uninstalled, cleared data, or the
 * browser revoked the subscription).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return; // push not configured yet — no-op

  const subs = await PushSubscription.find({ userId }).lean();
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone — clean it up so we stop retrying it.
          await PushSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {});
        }
      }
    })
  );
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
