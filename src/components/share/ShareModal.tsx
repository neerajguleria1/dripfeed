import { useCallback } from 'react';
import { Link, MessageCircle, Share2, Camera } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';

export interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  savings?: number;
}

function appendRefParam(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('ref', 'share');
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}ref=share`;
  }
}

export function ShareModal({ open, onClose, title, url, savings }: ShareModalProps) {
  const { toast } = useToast();
  const shareUrl = appendRefParam(url);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Link copied!');
    }
  }, [shareUrl, toast]);

  const handleWhatsApp = useCallback(() => {
    const savingsText = savings ? ` — save up to ₹${savings}` : '';
    const message = `Check this out! ${title}${savingsText} on DripFeed: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }, [title, savings, shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title,
        text: savings ? `${title} — save up to ₹${savings} on DripFeed` : `${title} on DripFeed`,
        url: shareUrl,
      });
    } catch { /* User cancelled */ }
  }, [title, savings, shareUrl]);

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  // Instagram has no public web share-link API (unlike WhatsApp's wa.me).
  // On mobile, the OS share sheet (native share button below) already lists
  // Instagram as an option if the Instagram app is installed. This button is
  // a direct shortcut into that same OS share sheet, just labeled for
  // Instagram so users who specifically want to share there see it clearly.
  // On desktop (no navigator.share), we fall back to copying the link and
  // instructing the user to paste it into Instagram manually.
  const handleInstagram = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: savings ? `${title} — save up to ₹${savings} on DripFeed` : `${title} on DripFeed`,
          url: shareUrl,
        });
      } catch { /* User cancelled */ }
      return;
    }
    // Desktop fallback: copy link, guide user to paste into IG manually.
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied! Paste it into your Instagram Story or DM.');
    } catch {
      toast.error('Could not copy link automatically. Copy it manually to share on Instagram.');
    }
  }, [title, savings, shareUrl, toast]);

  return (
    <Modal open={open} onClose={onClose} title="Share" size="sm">
      <div className="flex flex-col gap-3">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left w-full"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 shrink-0">
            <Link className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Copy Link</p>
            <p className="text-sm text-gray-500">Share via link</p>
          </div>
        </button>

        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left w-full"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">WhatsApp</p>
            <p className="text-sm text-gray-500">Send to contacts</p>
          </div>
        </button>

        <button
          onClick={handleInstagram}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left w-full"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-pink-50 text-pink-600 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Instagram</p>
            <p className="text-sm text-gray-500">
              {hasNativeShare ? 'Share to Story or DM' : 'Copy link to paste in Instagram'}
            </p>
          </div>
        </button>

        {hasNativeShare && (
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left w-full"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-50 text-purple-600 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Share</p>
              <p className="text-sm text-gray-500">Use device share menu</p>
            </div>
          </button>
        )}
      </div>
    </Modal>
  );
}

export default ShareModal;
