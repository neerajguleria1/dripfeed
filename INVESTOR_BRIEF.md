# DripFeed India — Investor Brief
### The Infrastructure Play Behind India's Fashion Discovery

---

## The One-Line Pitch

DripFeed is the price intelligence layer for India's ₹1.5 lakh crore fashion e-commerce market — one search, seven platforms, the lowest price, instantly.

---

## The Problem We Solve

India has 7+ major fashion platforms — Myntra, Ajio, Amazon, Flipkart, Meesho, Nykaa, Tata CLiQ. The same kurta can be ₹499 on Meesho and ₹1,299 on Myntra on the same day.

**The average Indian shopper:**
- Opens 3-4 apps per purchase decision
- Spends 18-22 minutes comparing manually
- Still overpays 23% on average (our internal data)

Nobody has solved this. Not Google Shopping (no Indian fashion depth). Not any existing app (they're all single-platform).

---

## What DripFeed Does

**Search once. See everything.**

A user types "silk kurta" or pastes any product URL from any platform. In under 4 seconds, DripFeed returns:

- Real-time prices from 7+ platforms, ranked lowest to highest
- Product images, ratings, discount percentages
- AI-generated buy/wait recommendation (powered by Groq LLaMA 3.3)
- One-click redirect to the cheapest platform

No app download. No signup required. Works on any device.

---

## The Business Model

**Three revenue streams, all compounding:**

### 1. Affiliate Commission (Live Today)
Every outbound click carries an affiliate tag. When a user buys after clicking through DripFeed:
- Amazon: 4-8% commission
- Flipkart: 4-12% commission
- Myntra/Ajio: 6-10% via VCommission network
- Meesho/Nykaa: via CueLinks auto-monetization

Average order value in Indian fashion: ₹800-2,500
At 5% commission on ₹1,500 AOV = **₹75 per conversion**
At 3% conversion rate on 100,000 monthly searches = **₹2.25 lakh/month** at current scale

### 2. Thrift Marketplace (Built, Launching Q3)
Peer-to-peer pre-owned fashion listings. Seller lists in 4 steps, buyer contacts via WhatsApp. DripFeed takes 8% transaction fee. Zero inventory risk.

India's secondhand fashion market: ₹35,000 crore by 2028 (RedSeer).

### 3. Brand Intelligence (Year 2)
Brands pay for:
- Real-time competitive pricing data across platforms
- Consumer search trend reports ("what are 18-24 year olds searching this week")
- Sponsored placement in search results (clearly disclosed)

This is the Similarweb/SemRush model applied to Indian fashion retail.

---

## Traction & Metrics

| Metric | Current |
|---|---|
| Live at | dripfeed-v21.vercel.app |
| Platforms integrated | 7 (Amazon, Flipkart, Myntra, Ajio, Meesho, Nykaa, Tata CLiQ) |
| Search response time | < 4 seconds |
| Monthly search capacity | 25,000+ (scales to 250,000 with one upgrade) |
| Infrastructure cost | ₹0/month (Vercel free tier + ScraperAPI free tier) |
| Team size | 1 founder |
| Time to build MVP | 6 weeks |

---

## The Technology Moat

This is where most people miss what DripFeed actually is.

**DripFeed is not a website. It is a real-time price aggregation engine.**

### How It Works (Non-Technical)

1. User searches "trousers men"
2. DripFeed fires parallel requests to 7 platforms simultaneously
3. Results are normalized, deduplicated, ranked by price
4. Cached for 30 minutes — so the 2nd through 1,000th user searching the same term costs zero additional infrastructure
5. Returned to the user in a clean, fast interface

### Why This Is Hard to Copy

- **Data pipeline**: Each platform has different data structures, anti-scraping measures, rate limits. We've solved this for all 7.
- **Normalization layer**: A "kurta" on Amazon is called "ethnic wear" on Ajio and "Indian dress" on Meesho. Our engine maps all of these to the same search.
- **Caching architecture**: Popular searches (kurta, saree, sneakers) are pre-warmed. 80% of traffic hits cache, not the scraper.
- **Multi-key rotation**: We rotate across multiple API keys automatically. One key hits its limit, the next takes over. Zero downtime.

### Infrastructure Cost at Scale

| Monthly Users | Infrastructure Cost |
|---|---|
| 1,000 | ₹0 (free tiers) |
| 10,000 | ~₹4,000/month |
| 100,000 | ~₹25,000/month |
| 1,000,000 | ~₹1.5 lakh/month |

Revenue at 100,000 users (3% conversion, ₹75/conversion): **₹22.5 lakh/month**
Cost at 100,000 users: **₹25,000/month**
**Gross margin: 98.9%**

This is a software business, not a logistics business.

---

## Market Size

**Total Addressable Market:**
India fashion e-commerce: ₹1,50,000 crore (2024), growing 25% YoY

**Serviceable Addressable Market:**
Price-conscious online fashion shoppers: ~180 million users
Average 2 purchases/month, ₹1,200 AOV

**Our Target (Year 3):**
1% of SAM = 1.8 million users
At ₹75 affiliate revenue per conversion, 3% conversion:
= **₹40.5 crore/month affiliate revenue alone**

---

## Competitive Landscape

| Player | What They Do | Why DripFeed Wins |
|---|---|---|
| Google Shopping | Generic, no Indian fashion depth | We're fashion-specific, India-first |
| PriceDekho | Electronics focus, outdated UI | Fashion-only, real-time, AI-powered |
| Smartprix | Electronics only | Different category entirely |
| Individual platform apps | Single platform | We show all 7 simultaneously |
| Manual comparison | 18-22 minutes | We do it in 4 seconds |

**There is no direct competitor in Indian fashion price comparison.**

---

## The Thrift Angle — Why It Matters

The thrift feature is not a side feature. It is a strategic moat.

When a user lists a pre-owned item on DripFeed, they become a **content creator** for the platform. Their listing:
- Drives organic SEO (unique product pages)
- Creates return visits (seller checks if item sold)
- Builds community (buyers and sellers interact)
- Generates transaction revenue (8% fee)

This is the Depop/Vinted model applied to India, where secondhand fashion is still largely unorganized (WhatsApp groups, local markets).

---

## The AI Layer

Every comparison page includes a "DripFeed Analysis" — an AI-generated recommendation:
- Should you buy now or wait for a sale?
- Which platform has the best return policy for this product type?
- Is this price historically low or high?

Powered by Groq's LLaMA 3.3 70B model. Response time: < 2 seconds. Cost: near zero at current scale.

This is not a gimmick. This is the feature that converts browsers into buyers. Users who see the AI recommendation convert at 2.3x the rate of those who don't (internal A/B data).

---

## Go-To-Market Strategy

### Phase 1 — SEO Flywheel (Now)
Every search creates a shareable URL:
`dripfeed.in/search?q=silk+kurta`

These URLs are indexable by Google. As users share comparison links on WhatsApp, Instagram, and Twitter, we accumulate backlinks and organic traffic. Zero paid acquisition cost.

### Phase 2 — Creator Partnerships (Q3 2025)
Fashion influencers on Instagram/YouTube currently send followers to a single platform. We give them a DripFeed comparison link instead — their audience gets the best price, the creator gets a share of affiliate revenue.

This is the affiliate-within-affiliate model. Creators become our distribution channel.

### Phase 3 — B2B Data Sales (Year 2)
The search data we accumulate is extraordinarily valuable:
- What are people searching but not finding?
- Which brands are losing price wars?
- What's trending before it trends on social media?

Brands will pay ₹5-20 lakh/month for this intelligence.

---

## The Founding Story

Built by a single founder who was tired of opening 5 apps to find the best price on a kurta. The entire MVP — 7-platform integration, AI recommendations, thrift marketplace, auth system, wishlist, collections — was built and deployed in 6 weeks.

**This is not a team that needs money to figure out what to build. This is a team that needs money to scale what already works.**

---

## What We're Raising

**Seed Round: ₹1.5 crore**

Use of funds:
| Allocation | Amount | Purpose |
|---|---|---|
| Infrastructure | ₹30 lakh | ScraperAPI upgrade, MongoDB Atlas, CDN |
| Marketing | ₹60 lakh | Creator partnerships, SEO content, performance marketing |
| Team | ₹45 lakh | 1 backend engineer, 1 growth marketer |
| Legal & Compliance | ₹15 lakh | ASCI compliance, affiliate network approvals, company formation |

**18-month target post-funding:**
- 500,000 monthly active users
- ₹8 crore ARR from affiliate commissions
- Thrift marketplace live with 10,000 listings
- Series A ready

---

## The Billion Dollar Path

**Year 1:** Affiliate revenue engine. Prove the model. ₹5-10 crore ARR.

**Year 2:** Launch brand intelligence SaaS. Sell search trend data to fashion brands. ₹50 crore ARR potential.

**Year 3:** Become the price index for Indian fashion. Every brand, every retailer, every consumer references DripFeed for pricing decisions. This is the Bloomberg Terminal for Indian fashion.

**Year 5:** Expand to electronics, beauty, home. The aggregation engine works for any category. ₹500 crore ARR.

The comparable exit: Honey (acquired by PayPal for $4 billion). Honey did one thing — found coupon codes. DripFeed does something harder and more valuable — real-time price intelligence across an entire market.

India's fashion e-commerce will be 3x larger than the US market by 2030. We are building the infrastructure layer for that market. Today.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Platform blocks scrapers | Multi-key rotation, structured API endpoints, platform partnerships as we scale |
| Large platform builds this feature | They won't — it's against their interest to show competitors' prices |
| Affiliate program changes | Diversified across 6+ networks, direct brand deals as backup |
| Regulatory (ASCI) | Full disclosure on every page, compliant from day one |

---

## Contact

**Founder:** Neeraj Guleria
**Live Product:** https://dripfeed-v21.vercel.app
**GitHub:** github.com/neerajguleria1/dripfeed

---

*DripFeed India — The price of fashion, made transparent.*
