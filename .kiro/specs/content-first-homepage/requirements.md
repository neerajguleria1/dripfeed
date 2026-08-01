# Requirements Document

## Introduction

Content-First Homepage Redesign for TagCheck (DripFeed) — a fashion price comparison platform aggregating products from 5 Indian e-commerce platforms (Ajio, Amazon, Flipkart, Myntra, Meesho). The current homepage has a 75-80% viewport dark hero section that causes users to bounce in under 1 second because no products are visible without scrolling. Average session time is 1 second across 170+ users.

This feature replaces the marketing-style landing page with a content-first discovery feed inspired by Pinterest, Myntra, and Instagram Explore. The goal is to show products above the fold immediately, use skeleton screens for perceived instant load, and create a visually rich scrollable feed that retains users without requiring search intent.

Technical stack: React 19, Vite, Tailwind v4, Vercel serverless, existing API routes (/products/deals, /products/trending, /search/product). Design tokens: warm white (#F8F5F2), navy (#1A1A2E), gold (#C9A96E). Mobile-first (85%+ traffic is mobile in India).

## Glossary

- **Homepage**: The root route (/) of the TagCheck website serving as the primary entry point for all users
- **Sticky_Header**: A compact fixed-position navigation bar at the top of the viewport containing the logo, search input, and user actions that remains visible during scroll
- **Product_Grid**: A responsive grid layout displaying product cards with images, prices, discount information, and platform badges
- **Product_Card**: A visual component displaying a single product's image, title, price, original price, discount percentage, savings amount, and source platform badge
- **Category_Chip**: A horizontally scrollable pill-shaped filter button representing a fashion category (e.g., "Kurta Sets", "Sneakers", "Sarees")
- **Discovery_Feed**: The vertically scrollable infinite-scroll content area below the initial product grid containing mixed product sections (deals, trending, categories)
- **Skeleton_Screen**: An animated placeholder UI matching the layout of final content, rendered immediately in the initial HTML/CSS before JavaScript hydration and API responses
- **Platform_Badge**: A small visual indicator on each Product_Card showing which e-commerce platform (Ajio, Amazon, Flipkart, Myntra, or Meesho) the product listing originates from
- **Above_The_Fold**: The portion of the Homepage visible in the browser viewport without any scrolling, approximately the first 600-800px of vertical content on mobile devices
- **Savings_Label**: A text element on each Product_Card displaying either the discount percentage or the absolute rupee amount saved (e.g., "Save ₹450" or "−32%")
- **Compare_Action**: A tap target on each Product_Card that navigates the user to the compare page showing the same product across multiple platforms
- **Infinite_Scroll**: A pattern where additional content sections load automatically as the user scrolls toward the bottom of the current viewport, without requiring pagination clicks
- **Preloaded_Data**: Cached product data served from Vercel edge cache or in-memory LRU cache that does not require a fresh database query on each page load
- **Geo_Region**: The geographic location of the user determined by IP address or browser locale, used to select region-appropriate content and currency formatting

## Requirements

### Requirement 1: Compact Sticky Header with Integrated Search

**User Story:** As a user landing on the homepage, I want the navigation and search to occupy minimal vertical space, so that product content is visible immediately without scrolling.

#### Acceptance Criteria

1. THE Sticky_Header SHALL occupy no more than 56px of vertical height on mobile and 64px on desktop
2. THE Sticky_Header SHALL contain the TagCheck logo, a search input field, and user action icons (wishlist, account) arranged horizontally
3. THE Sticky_Header SHALL remain fixed at the top of the viewport during vertical scrolling
4. WHEN a user taps the search input in the Sticky_Header, THE Homepage SHALL expand the input to full width and display recent searches and trending terms as suggestions
5. WHEN a user submits a search query from the Sticky_Header, THE Homepage SHALL navigate to the search results page with the query pre-filled
6. THE Sticky_Header SHALL use a translucent background with backdrop blur effect that allows content to scroll beneath it without obscuring readability

### Requirement 2: Above-The-Fold Product Grid

**User Story:** As a user arriving on the homepage, I want to see real fashion products with images and prices immediately in the first viewport, so that I understand this is a shopping discovery app and have content to engage with.

#### Acceptance Criteria

1. THE Homepage SHALL display a minimum of 4 Product_Cards within the Above_The_Fold region on mobile devices (viewport height 667px) and a minimum of 6 Product_Cards on desktop viewports
2. THE Product_Grid SHALL render within the first 600px of vertical page content (below the Sticky_Header) with no interstitial hero section, banner, or explanatory text block between the header and product content
3. THE Product_Grid SHALL use a 2-column layout on mobile screens (below 640px width) and a 3-to-4-column layout on desktop screens (above 640px width)
4. WHEN deal products are available from the /products/deals API, THE Product_Grid SHALL display deal products sorted by highest discount percentage first
5. WHEN deal products are unavailable, THE Product_Grid SHALL fall back to displaying trending products from the /products/trending API
6. WHEN both deal and trending API responses are empty, THE Product_Grid SHALL display a curated set of at least 8 hardcoded seed products from the application's static seed data

### Requirement 3: Product Card with Savings Messaging and Platform Attribution

**User Story:** As a price-conscious shopper, I want to see how much I save on each product and which platform offers it, so that I can quickly identify good deals and trust the source.

#### Acceptance Criteria

1. THE Product_Card SHALL display the product image, product title (truncated to 2 lines), current price in INR format (₹X,XXX), and the source Platform_Badge
2. WHEN a product has an original price higher than the current price, THE Product_Card SHALL display the original price with strikethrough formatting and a Savings_Label showing the discount percentage (e.g., "−32%")
3. WHEN the absolute savings amount exceeds ₹200, THE Product_Card SHALL display a "Save ₹X" label in addition to the discount percentage
4. THE Platform_Badge SHALL display the platform name with the platform's brand color indicator (Ajio: #000000, Amazon: #FF9900, Flipkart: #2874F0, Myntra: #FF3F6C, Meesho: #570741)
5. WHEN a user taps anywhere on the Product_Card, THE Homepage SHALL navigate to the compare page with the product title pre-filled as the comparison query
6. THE Product_Card SHALL include a visible Compare_Action button that provides an explicit affordance for price comparison navigation

### Requirement 4: Category Chips for Quick Filtering

**User Story:** As a user browsing without a specific product in mind, I want to quickly filter products by fashion category, so that I can narrow the feed to items relevant to my interest without typing a search.

#### Acceptance Criteria

1. THE Homepage SHALL display a horizontal row of Category_Chips between the Sticky_Header and the Product_Grid
2. THE Category_Chip row SHALL be horizontally scrollable on mobile devices and display at least 8 categories without wrapping
3. THE Category_Chip row SHALL include the following categories at minimum: "All", "Trending", "Kurta Sets", "Sneakers", "Sarees", "Jeans", "Dresses", "Ethnic Wear"
4. WHEN a user taps a Category_Chip, THE Product_Grid SHALL filter to display products matching the selected category by triggering a search query for that category term
5. WHEN the "All" Category_Chip is selected, THE Product_Grid SHALL display the default deals or trending products without category filtering
6. THE Homepage SHALL visually distinguish the currently selected Category_Chip from unselected chips using the gold accent color (#C9A96E) as background fill

### Requirement 5: Skeleton Screens for Perceived Instant Load

**User Story:** As a user on a mobile connection, I want to see the page layout and content placeholders immediately, so that I perceive the page as fast-loading and stay engaged while real data loads.

#### Acceptance Criteria

1. THE Homepage SHALL render Skeleton_Screens for the Product_Grid within 200ms of the initial page paint, before any API response is received
2. THE Skeleton_Screen for each Product_Card SHALL replicate the exact dimensions and layout of a loaded Product_Card including image area (aspect ratio 3:4), title lines, and price line
3. THE Skeleton_Screen SHALL use a subtle pulse animation (opacity oscillation between 0.4 and 1.0) to indicate loading state
4. WHEN API data arrives, THE Homepage SHALL replace Skeleton_Screens with real Product_Cards using a fade-in transition of 300ms duration
5. THE Homepage SHALL render a minimum of 6 Skeleton_Screen placeholders on mobile and 8 on desktop to fill the visible viewport during loading
6. IF the API request takes longer than 5 seconds, THEN THE Homepage SHALL display the hardcoded seed product data as a fallback and retry the API call in the background

### Requirement 6: Infinite Scroll Discovery Feed

**User Story:** As an engaged user scrolling past the initial product grid, I want to see continuously loaded content sections with diverse product categories, so that I keep discovering products without hitting a dead end.

#### Acceptance Criteria

1. WHEN a user scrolls within 200px of the bottom of the currently loaded content, THE Discovery_Feed SHALL request and append the next batch of products (12 products per batch)
2. THE Discovery_Feed SHALL present content in themed sections with section headers (e.g., "Today's Deals", "Trending Now", "Under ₹999", "Ethnic Favorites")
3. THE Discovery_Feed SHALL display a loading indicator (3 Skeleton_Screen cards) at the bottom while the next batch is being fetched
4. WHEN no more content is available from the API, THE Discovery_Feed SHALL display a "You've seen it all! Try searching for something specific" message with a search prompt
5. THE Discovery_Feed SHALL load a maximum of 5 additional batches (60 products total beyond the initial grid) to prevent excessive memory usage on mobile devices
6. WHEN the user scrolls back to the top, THE Homepage SHALL display a "Back to top" floating button that smooth-scrolls to the Product_Grid

### Requirement 7: Mobile-First Responsive Layout

**User Story:** As a mobile user (85% of traffic), I want the homepage to be optimized for touch interaction and small screens, so that I can browse products comfortably with one hand.

#### Acceptance Criteria

1. THE Homepage SHALL use touch-friendly tap targets with a minimum size of 44x44px for all interactive elements (Product_Cards, Category_Chips, buttons)
2. THE Homepage SHALL render the Product_Grid in a 2-column layout with 8px gap on screens below 640px width, and expand to 3-column (640px-1024px) or 4-column (above 1024px) on larger screens
3. THE Homepage SHALL support pull-to-scroll interaction without interfering with the browser's native scroll behavior
4. THE Product_Card image area SHALL maintain an aspect ratio of 3:4 on all viewport sizes to ensure consistent visual rhythm in the grid
5. THE Category_Chip row SHALL support horizontal swipe gestures with momentum scrolling on touch devices
6. THE Homepage SHALL hide the bottom browser chrome area (URL bar) on mobile browsers when the user scrolls down by using 100dvh viewport units for the initial layout calculation

### Requirement 8: Performance and Caching for Sub-Second Perceived Load

**User Story:** As a user on a 4G mobile connection in India, I want the homepage to feel loaded within 1 second of arrival, so that I begin browsing before losing attention.

#### Acceptance Criteria

1. THE Homepage SHALL achieve a Largest Contentful Paint (LCP) of under 1.5 seconds on a simulated 4G connection (1.6Mbps download, 150ms RTT)
2. THE Homepage SHALL serve product data from Preloaded_Data (Vercel edge cache or server LRU cache) for the initial Product_Grid, avoiding fresh database queries on every page load
3. THE Homepage SHALL prefetch the first 8 product images using link rel="preload" tags in the document head for products served from cache
4. WHEN cached data is stale (older than 15 minutes), THE Homepage SHALL serve the stale cache immediately and revalidate in the background (stale-while-revalidate pattern)
5. THE Homepage SHALL lazy-load all product images below the fold using native loading="lazy" attribute, loading only Above_The_Fold images eagerly
6. THE Homepage JavaScript bundle for the initial route SHALL not exceed 120KB gzipped (excluding vendor chunks shared across routes)

### Requirement 9: Geo-Aware Content Foundation

**User Story:** As an international user (particularly from the USA), I want to see content relevant to my region or a clear indication of the platform's market focus, so that I do not bounce immediately upon seeing irrelevant prices and brands.

#### Acceptance Criteria

1. WHEN a user's Geo_Region is detected as outside India, THE Homepage SHALL display a dismissible banner stating "TagCheck currently compares prices from Indian fashion platforms. Global platforms coming soon."
2. THE Homepage SHALL detect Geo_Region using the Accept-Language header and Vercel's x-vercel-ip-country header without requiring external geolocation API calls
3. WHEN the Geo_Region is India, THE Homepage SHALL display prices in INR format (₹) with Indian number formatting (lakh/thousand separators)
4. WHEN the Geo_Region is outside India, THE Homepage SHALL still display INR prices but append "(INR)" label for clarity
5. THE Homepage SHALL store the user's dismissed geo-banner state in localStorage to avoid showing the banner on repeat visits
6. WHERE a future global expansion is enabled, THE Homepage SHALL support a region selector in the Sticky_Header that switches between "India" and other supported regions

