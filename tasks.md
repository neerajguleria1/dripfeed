# DripFeed Website — MVP Tasks
# Goal: Search → Compare → AI Recommendation → Affiliate Redirect → Purchase
# Stack: React + Vite + Vercel Serverless Functions
# Backend: Vercel API routes (no separate server needed)
# Reference: Use mern/backend/src as reference for logic, port to serverless

---

## Phase 1: Vercel Serverless API Setup

- [x] 1.1 Create api/ folder structure and install dependencies
  - Create `Website/api/` folder for Vercel serverless functions
  - Install: `npm i mongoose groq-sdk jsonwebtoken bcryptjs google-auth-library axios`
  - Create `Website/api/_lib/db.ts` — MongoDB connection (reuse connection in serverless)
  - Create `Website/api/_lib/auth.ts` — JWT verify middleware helper
  - Create `Website/api/_lib/affiliate.ts` — Affiliate URL builder (VCommission, Amazon, Flipkart, Cuelinks formats)
  - Create `Website/vercel.json` with rewrites: `{ "rewrites": [{ "source": "/api/:path*", "destination": "/api/:path*" }] }`
  - Update `Website/vite.config.ts` — proxy `/api` to Vercel dev server (port 3000)

- [x] 1.2 Create MongoDB models
  - `Website/api/_lib/models/User.ts` — email, password, name, googleId, role, createdAt
  - `Website/api/_lib/models/Product.ts` — title, brand, platform, price, originalPrice, discount, url, imageUrl, rating, lastUpdated
  - `Website/api/_lib/models/AffiliateClick.ts` — userId?, platform, productName, sourceUrl, affiliateUrl, device, converted, revenue, createdAt
  - `Website/api/_lib/models/WishlistItem.ts` — userId, productTitle, sourceUrl, platform, savedPrice, imageUrl, brand, createdAt

- [x] 1.3 Build auth API routes
  - `Website/api/auth/register.ts` — POST, create user with hashed password, return JWT
  - `Website/api/auth/login.ts` — POST, verify credentials, return accessToken + refreshToken
  - `Website/api/auth/google.ts` — POST, verify Google token, create/find user, return JWT
  - `Website/api/auth/refresh.ts` — POST, verify refresh token, return new access token
  - `Website/api/auth/me.ts` — GET, return current user from token

- [x] 1.4 Build search API route
  - `Website/api/search/product.ts` — POST { query }
  - Use the search logic from `mern/backend/src/services/searchService.js` as reference
  - Search should return products from multiple platforms (use scraping/API as available)
  - For MVP: use mock data or simple web search via axios if no affiliate APIs ready
  - Return: `{ products: [{ title, brand, platform, price, originalPrice, discount, url, imageUrl, rating }] }`

- [x] 1.5 Build compare API route
  - `Website/api/products/compare.ts` — GET ?q=query
  - Search product across platforms, group by platform, find lowest price
  - Return: `{ platforms: [...], lowest: {...}, savings: number }`

- [x] 1.6 Build AI recommendation route
  - `Website/api/products/ai-recommend.ts` — POST { productTitle, platforms }
  - Use Groq SDK with llama-3.3-70b-versatile (copy logic from `mern/backend/src/services/aiService.js`)
  - Return: `{ summary, pros, cons, recommendation, bestPlatform }`

- [x] 1.7 Build affiliate redirect route
  - `Website/api/affiliate/redirect.ts` — POST { platform, productUrl, productName, userId?, device? }
  - Build affiliate URL per platform (VCommission, Amazon tag, Flipkart, Cuelinks)
  - Log click to AffiliateClick collection
  - Return: `{ affiliateUrl }`
  - NEVER throw error — if affiliate tag missing, return original URL

- [x] 1.8 Build wishlist routes
  - `Website/api/wishlist/index.ts` — GET (list user's saved items), POST (add item)
  - `Website/api/wishlist/[id].ts` — DELETE (remove item)
  - Auth required for all wishlist routes

---

## Phase 2: Frontend — Connect to API & Complete Flow

- [x] 2.1 Update API service for Vercel dev
  - Update `Website/src/services/api.ts` baseURL to work with both local dev proxy and production Vercel
  - Ensure auth interceptor works with the new JWT flow

- [~] 2.2 Add AI recommendation to ComparePage
  - After price comparison loads, call `POST /api/products/ai-recommend`
  - Show recommendation card below comparison table: summary, pros/cons, buy/wait advice
  - Loading state while AI generates
  - Graceful fallback if AI fails (just don't show recommendation)

- [ ] 2.3 Fix HomePage to work without backend
  - Homepage currently calls `/api/v1/search/product` for trending — this crashes if backend is down
  - Add error handling: if trending fails, show static featured categories instead
  - Homepage should NEVER show blank/broken state

- [ ] 2.4 Add Toast notification component
  - `Website/src/components/ui/Toast.tsx`
  - Show success/error messages (saved to wishlist, login success, etc.)
  - Position: bottom center, auto-dismiss 3 seconds

- [ ] 2.5 Add mobile bottom navigation
  - `Website/src/components/layout/BottomNav.tsx`
  - 4 items: Home, Search, Saved, Account
  - Show only on mobile (hidden sm: and up)
  - Fixed bottom, 44px min tap targets

- [ ] 2.6 Build Thrift pages
  - `Website/src/pages/ThriftPage.tsx` — browse thrift listings with filters
  - `Website/src/pages/ThriftListPage.tsx` — 4-step form to list an item
  - `Website/api/thrift/index.ts` — GET (list), POST (create)
  - `Website/api/thrift/[id].ts` — GET, PUT, DELETE
  - WhatsApp contact button (wa.me deep link)

---

## Phase 3: Polish & Deploy

- [ ] 3.1 Add SEO meta tags
  - Install react-helmet-async
  - Add title, description, og:tags to each page
  - Homepage: "DripFeed India: Compare Fashion Prices Across Myntra, Ajio, Amazon & More"

- [ ] 3.2 Add ASCI disclosure badges everywhere
  - Ensure #Ad badge appears near every affiliate link
  - Footer disclosure text
  - ComparePage top disclosure (already partially done)

- [ ] 3.3 Setup environment variables
  - Create `Website/.env.example` with all required vars
  - VITE_API_URL (for client-side if needed)
  - MONGO_URI, JWT_SECRET, GROQ_API_KEY, GOOGLE_CLIENT_ID
  - Affiliate IDs: VCOMMISSION_ID, AMAZON_TAG, FLIPKART_ID, CUELINKS_ID

- [ ] 3.4 Verify full flow works end-to-end
  - `npm run build` passes
  - Homepage loads without errors
  - Search returns results
  - Compare shows price comparison + AI recommendation
  - Affiliate button redirects through backend logging
  - Wishlist save/remove works
  - Auth login/register works

- [ ] 3.5 Deploy to Vercel
  - vercel.json configured
  - Environment variables set in Vercel dashboard
  - Custom domain: dripfeed.in
  - All routes working in production
