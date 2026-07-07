import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

interface GoogleAuthButtonProps {
  onError?: (message: string) => void;
}

/**
 * Renders Google's official Sign In button. Silently renders nothing if
 * VITE_GOOGLE_CLIENT_ID isn't configured, so the app still works without it.
 */
export default function GoogleAuthButton({ onError }: GoogleAuthButtonProps) {
  const { googleLogin } = useAuth();

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  async function handleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      onError?.('Google sign-in failed. Please try again.');
      return;
    }
    try {
      await googleLogin(credentialResponse.credential);
    } catch {
      onError?.('Google sign-in failed. Please try again.');
    }
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.('Google sign-in failed. Please try again.')}
        theme="outline"
        shape="pill"
        size="large"
        width="280"
      />
    </div>
  );
}
