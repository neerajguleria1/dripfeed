import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { registerSW } from './registerSW'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const app = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  ),
)

registerSW()

// CueLinks Cuewords: auto-monetizes all outbound e-commerce links (Myntra, Ajio, Amazon, Flipkart, etc.)
// Set VITE_CUELINKS_PUB_ID in Vercel env vars once your CueLinks publisher account is approved
const cuelinksPubId = import.meta.env.VITE_CUELINKS_PUB_ID
if (cuelinksPubId) {
  const s = document.createElement('script')
  s.src = `https://cdn.cuelinks.com/js/cuewords_${cuelinksPubId}.js`
  s.async = true
  document.head.appendChild(s)
}

// GA4 is loaded via index.html script tag (G-1HJVDPGNLB)
// gtag() is available globally for custom events
