/**
 * @deprecated — DO NOT IMPORT IN USER-FACING PAGES OR COMPONENTS.
 *
 * Seed data — manually curated product information based on publicly known
 * Indian fashion brands, typical pricing, and product categories.
 * This is editorial/reference data, not scraped content.
 * Images use Unsplash (free commercial license).
 *
 * This file is kept for reference and testing only. All rendering paths
 * must use real product data from the Search_Cache or live scraping APIs.
 * See Requirement 1.1, 1.6 in the tagcheck-premium-overhaul spec.
 */

export interface SeedProduct {
  title: string;
  brand: string;
  category: string;
  platforms: {
    platform: string;
    price: number;
    originalPrice: number;
    url: string;
  }[];
  imageUrl: string;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  // ─── Ethnic Wear ───
  {
    title: 'Libas Floral Anarkali Kurta Set',
    brand: 'Libas',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1449, originalPrice: 2999, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1399, originalPrice: 2999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=533&fit=crop',
  },
  {
    title: 'Biba Printed Straight Kurta with Palazzo',
    brand: 'Biba',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1599, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1799, originalPrice: 2999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 1699, originalPrice: 2999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=533&fit=crop',
  },
  {
    title: 'Anouk Banarasi Silk Saree',
    brand: 'Anouk',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 2199, originalPrice: 4999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 2499, originalPrice: 4999, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 1899, originalPrice: 4999, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=533&fit=crop',
  },
  {
    title: 'FabIndia Cotton Kurta with Mirror Work',
    brand: 'FabIndia',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1899, originalPrice: 3200, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2099, originalPrice: 3200, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&h=533&fit=crop',
  },
  {
    title: 'W for Woman Embroidered A-Line Kurta',
    brand: 'W',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 999, originalPrice: 1999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1149, originalPrice: 1999, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1049, originalPrice: 1999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1199, originalPrice: 1999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=533&fit=crop',
  },

  // ─── Western Wear ───
  {
    title: 'Snitch Slim Fit Oxford Shirt',
    brand: 'Snitch',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 899, originalPrice: 1799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 949, originalPrice: 1799, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=533&fit=crop',
  },
  {
    title: 'Bewakoof Oversized Graphic Tee - Anime',
    brand: 'Bewakoof',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 449, originalPrice: 899, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 499, originalPrice: 899, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 399, originalPrice: 899, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=533&fit=crop',
  },
  {
    title: 'Roadster Denim Trucker Jacket',
    brand: 'Roadster',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1999, originalPrice: 3499, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=533&fit=crop',
  },
  {
    title: 'H&M Regular Fit Linen Shirt',
    brand: 'H&M',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 1999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1499, originalPrice: 1999, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=533&fit=crop',
  },
  {
    title: 'Allen Solly Slim Fit Chinos',
    brand: 'Allen Solly',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1199, originalPrice: 2499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1299, originalPrice: 2499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1349, originalPrice: 2499, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1399, originalPrice: 2499, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=533&fit=crop',
  },
  {
    title: 'Zara Cropped Wide Leg Jeans',
    brand: 'Zara',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 2790, originalPrice: 3990, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2990, originalPrice: 3990, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=533&fit=crop',
  },

  // ─── Footwear ───
  {
    title: 'HRX Velocity 2.0 Running Shoes',
    brand: 'HRX',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1499, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1699, originalPrice: 2999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=533&fit=crop',
  },
  {
    title: 'Campus OXYFIT Running Shoes',
    brand: 'Campus',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1099, originalPrice: 1999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 999, originalPrice: 1999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1149, originalPrice: 1999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=533&fit=crop',
  },
  {
    title: 'Woodland Leather Chelsea Boots',
    brand: 'Woodland',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 3499, originalPrice: 5995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 3699, originalPrice: 5995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 3599, originalPrice: 5995, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&h=533&fit=crop',
  },
  {
    title: 'Puma RS-X Reinvention Sneakers',
    brand: 'Puma',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 4999, originalPrice: 8999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 5499, originalPrice: 8999, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 5299, originalPrice: 8999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 5199, originalPrice: 8999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&h=533&fit=crop',
  },

  // ─── Accessories ───
  {
    title: 'Fastrack Reflex 3.0 Smartwatch',
    brand: 'Fastrack',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 2499, originalPrice: 4995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 2399, originalPrice: 4995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2549, originalPrice: 4995, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=533&fit=crop',
  },
  {
    title: 'Lavie Luxury Tote Bag',
    brand: 'Lavie',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 2690, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1499, originalPrice: 2690, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1349, originalPrice: 2690, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=533&fit=crop',
  },
  {
    title: 'Titan Raga Viva Analog Watch',
    brand: 'Titan',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 3995, originalPrice: 5995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 4199, originalPrice: 5995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 4095, originalPrice: 5995, url: 'https://www.amazon.in' },
      { platform: 'tatacliq', price: 3895, originalPrice: 5995, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=533&fit=crop',
  },

  // ─── Fusion Wear ───
  {
    title: 'Global Desi Printed Kaftan Dress',
    brand: 'Global Desi',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 1499, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1599, originalPrice: 2999, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=533&fit=crop',
  },
  {
    title: 'Indya Indo-Western Crop Top & Skirt Set',
    brand: 'Indya',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 2199, originalPrice: 3999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2399, originalPrice: 3999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 2299, originalPrice: 3999, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=400&h=533&fit=crop',
  },

  // ─── Activewear ───
  {
    title: 'HRX Active Dry-Fit Training Tee',
    brand: 'HRX',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 499, originalPrice: 999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 549, originalPrice: 999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=533&fit=crop',
  },
  {
    title: 'Reebok Workout Plus Legacy Joggers',
    brand: 'Reebok',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1899, originalPrice: 3499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1999, originalPrice: 3499, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=533&fit=crop',
  },
];


// ─── More Products for a richer catalog ───
export const SEED_PRODUCTS_EXTENDED: SeedProduct[] = [
  // Party Wear
  { title: 'AND Sequin Bodycon Dress', brand: 'AND', category: 'western', platforms: [{ platform: 'myntra', price: 2499, originalPrice: 4999, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 2699, originalPrice: 4999, url: 'https://www.ajio.com' }], imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&h=533&fit=crop' },
  { title: 'Marks & Spencer Velvet Blazer', brand: 'M&S', category: 'western', platforms: [{ platform: 'myntra', price: 4999, originalPrice: 7999, url: 'https://www.myntra.com' }, { platform: 'tatacliq', price: 5299, originalPrice: 7999, url: 'https://www.tatacliq.com' }], imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=533&fit=crop' },
  { title: 'Mango Pleated Midi Skirt', brand: 'Mango', category: 'western', platforms: [{ platform: 'myntra', price: 1990, originalPrice: 3490, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 2190, originalPrice: 3490, url: 'https://www.ajio.com' }], imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aebd?w=400&h=533&fit=crop' },
  // Kurtas
  { title: 'Manyavar Silk Nehru Jacket Set', brand: 'Manyavar', category: 'ethnic-wear', platforms: [{ platform: 'myntra', price: 5999, originalPrice: 9999, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 6499, originalPrice: 9999, url: 'https://www.flipkart.com' }], imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=533&fit=crop' },
  { title: 'Kishwer Merchant x Anouk Palazzo Set', brand: 'Anouk', category: 'ethnic-wear', platforms: [{ platform: 'myntra', price: 1799, originalPrice: 3499, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 1999, originalPrice: 3499, url: 'https://www.ajio.com' }, { platform: 'meesho', price: 1599, originalPrice: 3499, url: 'https://www.meesho.com' }], imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=533&fit=crop' },
  // Sneakers
  { title: 'Nike Air Max 90 Essential', brand: 'Nike', category: 'footwear', platforms: [{ platform: 'myntra', price: 8995, originalPrice: 11995, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 9295, originalPrice: 11995, url: 'https://www.flipkart.com' }, { platform: 'amazon', price: 9195, originalPrice: 11995, url: 'https://www.amazon.in' }], imageUrl: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=400&h=533&fit=crop' },
  { title: 'Adidas Ultraboost Light Running', brand: 'Adidas', category: 'footwear', platforms: [{ platform: 'myntra', price: 12999, originalPrice: 16999, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 13499, originalPrice: 16999, url: 'https://www.flipkart.com' }, { platform: 'amazon', price: 13299, originalPrice: 16999, url: 'https://www.amazon.in' }], imageUrl: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=400&h=533&fit=crop' },
  { title: 'Bata Comfit Memory Foam Sandals', brand: 'Bata', category: 'footwear', platforms: [{ platform: 'myntra', price: 799, originalPrice: 1499, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 699, originalPrice: 1499, url: 'https://www.flipkart.com' }, { platform: 'amazon', price: 849, originalPrice: 1499, url: 'https://www.amazon.in' }], imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&h=533&fit=crop' },
  // Bags
  { title: 'Baggit Structured Sling Bag', brand: 'Baggit', category: 'accessories', platforms: [{ platform: 'myntra', price: 1199, originalPrice: 2190, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 1299, originalPrice: 2190, url: 'https://www.ajio.com' }, { platform: 'flipkart', price: 1249, originalPrice: 2190, url: 'https://www.flipkart.com' }], imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=533&fit=crop' },
  { title: 'Wildcraft 45L Trekking Backpack', brand: 'Wildcraft', category: 'accessories', platforms: [{ platform: 'myntra', price: 2499, originalPrice: 4499, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 2299, originalPrice: 4499, url: 'https://www.flipkart.com' }, { platform: 'amazon', price: 2599, originalPrice: 4499, url: 'https://www.amazon.in' }], imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=533&fit=crop' },
  // Sunglasses
  { title: 'Lenskart Vincent Chase Aviator', brand: 'Lenskart', category: 'accessories', platforms: [{ platform: 'myntra', price: 999, originalPrice: 1999, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 1099, originalPrice: 1999, url: 'https://www.flipkart.com' }], imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=533&fit=crop' },
  // Activewear
  { title: 'Nike Dri-FIT Training Shorts', brand: 'Nike', category: 'activewear', platforms: [{ platform: 'myntra', price: 1495, originalPrice: 2495, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 1595, originalPrice: 2495, url: 'https://www.ajio.com' }], imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=533&fit=crop' },
  { title: 'Puma Essential Logo Hoodie', brand: 'Puma', category: 'activewear', platforms: [{ platform: 'myntra', price: 1999, originalPrice: 3999, url: 'https://www.myntra.com' }, { platform: 'ajio', price: 2199, originalPrice: 3999, url: 'https://www.ajio.com' }, { platform: 'flipkart', price: 2099, originalPrice: 3999, url: 'https://www.flipkart.com' }], imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=533&fit=crop' },
  // Budget picks
  { title: 'Dennis Lingo Checkered Casual Shirt', brand: 'Dennis Lingo', category: 'western', platforms: [{ platform: 'myntra', price: 599, originalPrice: 1499, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 549, originalPrice: 1499, url: 'https://www.flipkart.com' }, { platform: 'meesho', price: 499, originalPrice: 1499, url: 'https://www.meesho.com' }], imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=533&fit=crop' },
  { title: 'Ketch Skinny Fit Stretchable Jeans', brand: 'Ketch', category: 'western', platforms: [{ platform: 'myntra', price: 699, originalPrice: 1599, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 649, originalPrice: 1599, url: 'https://www.flipkart.com' }, { platform: 'meesho', price: 599, originalPrice: 1599, url: 'https://www.meesho.com' }], imageUrl: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=400&h=533&fit=crop' },
  { title: 'Urbano Fashion Cargo Joggers', brand: 'Urbano', category: 'western', platforms: [{ platform: 'myntra', price: 799, originalPrice: 1999, url: 'https://www.myntra.com' }, { platform: 'flipkart', price: 749, originalPrice: 1999, url: 'https://www.flipkart.com' }, { platform: 'amazon', price: 899, originalPrice: 1999, url: 'https://www.amazon.in' }], imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=533&fit=crop' },
];

// ─── Premium Collection: 72 additional products ───
export const SEED_PRODUCTS_PREMIUM: SeedProduct[] = [

  // ─── Ethnic Wear (15 products) ───
  {
    title: 'Soch Chanderi Silk Saree with Zari Border',
    brand: 'Soch',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 2799, originalPrice: 4999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2999, originalPrice: 4999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 2899, originalPrice: 4999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558171813-7537213e15e5?w=400&h=533&fit=crop',
  },
  {
    title: 'Aurelia Printed Straight Kurta with Dupatta',
    brand: 'Aurelia',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1199, originalPrice: 2299, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1349, originalPrice: 2299, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1249, originalPrice: 2299, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=400&h=533&fit=crop',
  },
  {
    title: 'Kalki Georgette Lehenga Choli Set',
    brand: 'Kalki',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 4599, originalPrice: 7999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 4899, originalPrice: 7999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 4799, originalPrice: 7999, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=533&fit=crop',
  },
  {
    title: 'Manyavar Men Silk Sherwani Set',
    brand: 'Manyavar',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 7999, originalPrice: 12999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 8499, originalPrice: 12999, url: 'https://www.flipkart.com' },
      { platform: 'tatacliq', price: 8299, originalPrice: 12999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=533&fit=crop',
  },
  {
    title: 'Fabindia Handblock Print Dupatta',
    brand: 'FabIndia',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 899, originalPrice: 1599, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 999, originalPrice: 1599, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=533&fit=crop',
  },
  {
    title: 'Biba Women Embroidered Kurta Set with Churidar',
    brand: 'Biba',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1899, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2049, originalPrice: 3499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1999, originalPrice: 3499, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2099, originalPrice: 3499, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&h=533&fit=crop',
  },
  {
    title: 'Saree.com Kanjivaram Silk Saree',
    brand: 'Saree.com',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 3499, originalPrice: 5999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 3699, originalPrice: 5999, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 3199, originalPrice: 5999, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=533&fit=crop',
  },
  {
    title: 'W Ethnic Motif Anarkali with Embroidery',
    brand: 'W',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1499, originalPrice: 2799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1649, originalPrice: 2799, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 1599, originalPrice: 2799, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=533&fit=crop',
  },
  {
    title: 'Zudio Cotton Printed Kurta - Value Pack',
    brand: 'Zudio',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 499, originalPrice: 999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 549, originalPrice: 999, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 449, originalPrice: 999, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=533&fit=crop',
  },
  {
    title: 'Pantaloons Festive Silk Blend Kurta Set',
    brand: 'Pantaloons',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1899, originalPrice: 2999, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1849, originalPrice: 2999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=400&h=533&fit=crop',
  },
  {
    title: 'Libas Chikankari Embroidered Palazzo Set',
    brand: 'Libas',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1599, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1749, originalPrice: 2999, url: 'https://www.ajio.com' },
      { platform: 'meesho', price: 1449, originalPrice: 2999, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=533&fit=crop',
  },
  {
    title: 'Max Fashion Bandhani Print Kurta with Tassels',
    brand: 'Max Fashion',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 799, originalPrice: 1499, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 849, originalPrice: 1499, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 699, originalPrice: 1499, url: 'https://www.meesho.com' },
      { platform: 'amazon', price: 899, originalPrice: 1499, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=400&h=533&fit=crop',
  },
  {
    title: 'Anouk Banarasi Dupatta - Gold Zari',
    brand: 'Anouk',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 699, originalPrice: 1299, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 749, originalPrice: 1299, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=533&fit=crop',
  },
  {
    title: 'Westside Silk Blend Saree with Blouse Piece',
    brand: 'Westside',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 2199, originalPrice: 3999, url: 'https://www.myntra.com' },
      { platform: 'tatacliq', price: 2399, originalPrice: 3999, url: 'https://www.tatacliq.com' },
      { platform: 'ajio', price: 2299, originalPrice: 3999, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=533&fit=crop',
  },
  {
    title: 'Lifestyle Stores Lucknowi Chikan Kurta',
    brand: 'Lifestyle',
    category: 'ethnic-wear',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 2499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1399, originalPrice: 2499, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=533&fit=crop',
  },

  // ─── Western Wear (12 products) ───
  {
    title: 'Urbanic Corset Style Bodycon Dress',
    brand: 'Urbanic',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 2499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1399, originalPrice: 2499, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 1349, originalPrice: 2499, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1581338834647-b0fb40996d47?w=400&h=533&fit=crop',
  },
  {
    title: 'FableStreet Tailored Blazer - Navy',
    brand: 'FableStreet',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 3499, originalPrice: 5999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 3699, originalPrice: 5999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 3599, originalPrice: 5999, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=533&fit=crop',
  },
  {
    title: 'The Souled Store Oversized Hoodie - Minimalist',
    brand: 'The Souled Store',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1199, originalPrice: 1999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1249, originalPrice: 1999, url: 'https://www.flipkart.com' },
      { platform: 'bewakoof', price: 1099, originalPrice: 1999, url: 'https://www.bewakoof.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1487222477036-7d3a0a30c1c1?w=400&h=533&fit=crop',
  },
  {
    title: 'Snitch Co-Ord Set - Printed Shirt & Shorts',
    brand: 'Snitch',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1499, originalPrice: 2799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1599, originalPrice: 2799, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1549, originalPrice: 2799, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=533&fit=crop',
  },
  {
    title: 'Nykaa Fashion Wrap Jumpsuit - Olive Green',
    brand: 'Nykaa Fashion',
    category: 'western',
    platforms: [
      { platform: 'nykaa', price: 1799, originalPrice: 3299, url: 'https://www.nykaa.com' },
      { platform: 'myntra', price: 1899, originalPrice: 3299, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1949, originalPrice: 3299, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1490427712608-588e68359dbd?w=400&h=533&fit=crop',
  },
  {
    title: 'Bewakoof Crop Top - Tie Dye',
    brand: 'Bewakoof',
    category: 'western',
    platforms: [
      { platform: 'bewakoof', price: 399, originalPrice: 799, url: 'https://www.bewakoof.com' },
      { platform: 'myntra', price: 449, originalPrice: 799, url: 'https://www.myntra.com' },
      { platform: 'meesho', price: 349, originalPrice: 799, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=533&fit=crop',
  },
  {
    title: 'Massimo Dutti Linen Blend Trousers',
    brand: 'Massimo Dutti',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 3990, originalPrice: 5990, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 4190, originalPrice: 5990, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=533&fit=crop',
  },
  {
    title: 'Mango Satin Slip Dress - Emerald',
    brand: 'Mango',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 2990, originalPrice: 4990, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 3190, originalPrice: 4990, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 3090, originalPrice: 4990, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=400&h=533&fit=crop',
  },
  {
    title: 'Zudio Ribbed Bodysuit - Pack of 2',
    brand: 'Zudio',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 399, originalPrice: 799, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 449, originalPrice: 799, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 349, originalPrice: 799, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1519058082700-08a0b56da9b2?w=400&h=533&fit=crop',
  },
  {
    title: 'Max Fashion Denim Dungaree Dress',
    brand: 'Max Fashion',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1099, originalPrice: 1999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1149, originalPrice: 1999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1199, originalPrice: 1999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1550639525-c97d455acf70?w=400&h=533&fit=crop',
  },
  {
    title: 'Snitch Structured Formal Blazer - Charcoal',
    brand: 'Snitch',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 2499, originalPrice: 4499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2699, originalPrice: 4499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 2599, originalPrice: 4499, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c11e13d0e2e1?w=400&h=533&fit=crop',
  },
  {
    title: 'Pantaloons Women Floral Maxi Dress',
    brand: 'Pantaloons',
    category: 'western',
    platforms: [
      { platform: 'myntra', price: 1399, originalPrice: 2499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1499, originalPrice: 2499, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 1449, originalPrice: 2499, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=533&fit=crop',
  },

  // ─── Footwear (10 products) ───
  {
    title: 'Charles & Keith Strappy Block Heels',
    brand: 'Charles & Keith',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 3999, originalPrice: 5999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 4199, originalPrice: 5999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 4099, originalPrice: 5999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1560243563-062bfc001d68?w=400&h=533&fit=crop',
  },
  {
    title: 'Aldo Pointed Toe Stiletto Pumps',
    brand: 'Aldo',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 5499, originalPrice: 8999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 5799, originalPrice: 8999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 5699, originalPrice: 8999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=533&fit=crop',
  },
  {
    title: 'Metro Ethnic Kolhapuri Chappal',
    brand: 'Metro',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 899, originalPrice: 1699, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 949, originalPrice: 1699, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 999, originalPrice: 1699, url: 'https://www.amazon.in' },
      { platform: 'meesho', price: 799, originalPrice: 1699, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aebd?w=400&h=533&fit=crop',
  },
  {
    title: 'Woodland Suede Ankle Boots - Tan',
    brand: 'Woodland',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 3999, originalPrice: 6495, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 4199, originalPrice: 6495, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 4099, originalPrice: 6495, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?w=400&h=533&fit=crop',
  },
  {
    title: 'Nike Revolution 6 Sports Shoes',
    brand: 'Nike',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 2999, originalPrice: 4495, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 3199, originalPrice: 4495, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 3099, originalPrice: 4495, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=533&fit=crop',
  },
  {
    title: 'Mochi Women Embellished Flats - Gold',
    brand: 'Mochi',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1299, originalPrice: 2295, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1399, originalPrice: 2295, url: 'https://www.flipkart.com' },
      { platform: 'tatacliq', price: 1349, originalPrice: 2295, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=533&fit=crop',
  },
  {
    title: 'Adidas Adilette Comfort Slides',
    brand: 'Adidas',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1899, originalPrice: 2999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1849, originalPrice: 2999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&h=533&fit=crop',
  },
  {
    title: 'Bata Red Label Formal Oxfords',
    brand: 'Bata',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1999, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1899, originalPrice: 3499, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2099, originalPrice: 3499, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=400&h=533&fit=crop',
  },
  {
    title: 'Crocs Classic Clog - Lavender',
    brand: 'Crocs',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 2499, originalPrice: 3995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 2699, originalPrice: 3995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2599, originalPrice: 3995, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=533&fit=crop',
  },
  {
    title: 'Campus Royce Retro Sneakers',
    brand: 'Campus',
    category: 'footwear',
    platforms: [
      { platform: 'myntra', price: 1399, originalPrice: 2499, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1299, originalPrice: 2499, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1449, originalPrice: 2499, url: 'https://www.amazon.in' },
      { platform: 'meesho', price: 1199, originalPrice: 2499, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=400&h=533&fit=crop',
  },

  // ─── Accessories (10 products) ───
  {
    title: 'Voylla Kundan Choker Necklace Set',
    brand: 'Voylla',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 899, originalPrice: 1799, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 999, originalPrice: 1799, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 949, originalPrice: 1799, url: 'https://www.amazon.in' },
      { platform: 'meesho', price: 799, originalPrice: 1799, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=533&fit=crop',
  },
  {
    title: 'Hidesign Leather Belt - Classic Tan',
    brand: 'Hidesign',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 1499, originalPrice: 2495, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 1599, originalPrice: 2495, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 1549, originalPrice: 2495, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=533&fit=crop',
  },
  {
    title: 'Fossil Leather Bifold Wallet - Black',
    brand: 'Fossil',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 2499, originalPrice: 3995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 2699, originalPrice: 3995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2599, originalPrice: 3995, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=533&fit=crop',
  },
  {
    title: 'Accessorize London Silk Scarf - Paisley Print',
    brand: 'Accessorize',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 999, originalPrice: 1790, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1099, originalPrice: 1790, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=533&fit=crop',
  },
  {
    title: 'Yellow Chimes Jhumka Earrings - Oxidised Silver',
    brand: 'Yellow Chimes',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 399, originalPrice: 899, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 349, originalPrice: 899, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 449, originalPrice: 899, url: 'https://www.amazon.in' },
      { platform: 'meesho', price: 299, originalPrice: 899, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=533&fit=crop',
  },
  {
    title: 'Anekaant Printed Canvas Tote Bag',
    brand: 'Anekaant',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 599, originalPrice: 1199, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 649, originalPrice: 1199, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 499, originalPrice: 1199, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=533&fit=crop',
  },
  {
    title: 'Hair Drama Company Pearl Hair Clip Set',
    brand: 'Hair Drama Co',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 349, originalPrice: 699, url: 'https://www.myntra.com' },
      { platform: 'nykaa', price: 399, originalPrice: 699, url: 'https://www.nykaa.com' },
      { platform: 'amazon', price: 379, originalPrice: 699, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=533&fit=crop',
  },
  {
    title: 'Titan Octane Chronograph Watch',
    brand: 'Titan',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 6995, originalPrice: 9995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 7299, originalPrice: 9995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 7199, originalPrice: 9995, url: 'https://www.amazon.in' },
      { platform: 'tatacliq', price: 6899, originalPrice: 9995, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=533&fit=crop',
  },
  {
    title: 'DressBerry Statement Ring Set - Pack of 5',
    brand: 'DressBerry',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 299, originalPrice: 599, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 349, originalPrice: 599, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1485968579996-35ef07fbc07b?w=400&h=533&fit=crop',
  },
  {
    title: 'Caprese Faux Leather Satchel - Burgundy',
    brand: 'Caprese',
    category: 'accessories',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 3190, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1899, originalPrice: 3190, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1849, originalPrice: 3190, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=533&fit=crop',
  },

  // ─── Fusion Wear (8 products) ───
  {
    title: 'Vajor Handloom Cape with Dhoti Pants',
    brand: 'Vajor',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 2799, originalPrice: 4599, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2999, originalPrice: 4599, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 2899, originalPrice: 4599, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558171813-7537213e15e5?w=400&h=533&fit=crop',
  },
  {
    title: 'Indya Indo-Western Dhoti Saree',
    brand: 'Indya',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 2499, originalPrice: 4299, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2699, originalPrice: 4299, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 2599, originalPrice: 4299, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=533&fit=crop',
  },
  {
    title: 'Global Desi Jacket Style Kurta with Palazzo',
    brand: 'Global Desi',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 1999, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2199, originalPrice: 3499, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=533&fit=crop',
  },
  {
    title: 'W Fusion Printed Shirt Dress with Belt',
    brand: 'W',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 1599, originalPrice: 2799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1699, originalPrice: 2799, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 1649, originalPrice: 2799, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=533&fit=crop',
  },
  {
    title: 'FabIndia Block Print Cape Jacket',
    brand: 'FabIndia',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 2299, originalPrice: 3799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2499, originalPrice: 3799, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=533&fit=crop',
  },
  {
    title: 'Anouk Asymmetric Hem Tunic with Dhoti Pants',
    brand: 'Anouk',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 1799, originalPrice: 3199, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1899, originalPrice: 3199, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1849, originalPrice: 3199, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=400&h=533&fit=crop',
  },
  {
    title: 'Nykaa Fashion Indo-Western Peplum Top Set',
    brand: 'Nykaa Fashion',
    category: 'fusion-wear',
    platforms: [
      { platform: 'nykaa', price: 1499, originalPrice: 2699, url: 'https://www.nykaa.com' },
      { platform: 'myntra', price: 1599, originalPrice: 2699, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1649, originalPrice: 2699, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1544957992-20514f595d6f?w=400&h=533&fit=crop',
  },
  {
    title: 'Libas Fusion Mirror Work Cape Kurta',
    brand: 'Libas',
    category: 'fusion-wear',
    platforms: [
      { platform: 'myntra', price: 1399, originalPrice: 2599, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1499, originalPrice: 2599, url: 'https://www.ajio.com' },
      { platform: 'meesho', price: 1249, originalPrice: 2599, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=400&h=533&fit=crop',
  },

  // ─── Activewear (8 products) ───
  {
    title: 'Nykaa Fashion High-Waist Yoga Leggings',
    brand: 'Nykaa Fashion',
    category: 'activewear',
    platforms: [
      { platform: 'nykaa', price: 999, originalPrice: 1799, url: 'https://www.nykaa.com' },
      { platform: 'myntra', price: 1099, originalPrice: 1799, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1049, originalPrice: 1799, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=400&h=533&fit=crop',
  },
  {
    title: 'HRX Medium Impact Sports Bra - Black',
    brand: 'HRX',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 599, originalPrice: 1199, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 649, originalPrice: 1199, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=533&fit=crop',
  },
  {
    title: 'Puma Slim Fit Track Pants - Navy Blue',
    brand: 'Puma',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 1599, originalPrice: 2999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1699, originalPrice: 2999, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1649, originalPrice: 2999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=533&fit=crop',
  },
  {
    title: 'Nike Dri-FIT One Tank Top',
    brand: 'Nike',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 1295, originalPrice: 1995, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 1395, originalPrice: 1995, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 1345, originalPrice: 1995, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=400&h=533&fit=crop',
  },
  {
    title: 'Bewakoof Active Dry-Fit Running Shorts',
    brand: 'Bewakoof',
    category: 'activewear',
    platforms: [
      { platform: 'bewakoof', price: 499, originalPrice: 999, url: 'https://www.bewakoof.com' },
      { platform: 'myntra', price: 549, originalPrice: 999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 529, originalPrice: 999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=533&fit=crop',
  },
  {
    title: 'Adidas Essentials Zip-Up Hoodie',
    brand: 'Adidas',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 2799, originalPrice: 4499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2999, originalPrice: 4499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 2899, originalPrice: 4499, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 2949, originalPrice: 4499, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=533&fit=crop',
  },
  {
    title: 'The Souled Store Gym Stringer Vest',
    brand: 'The Souled Store',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 599, originalPrice: 999, url: 'https://www.myntra.com' },
      { platform: 'bewakoof', price: 649, originalPrice: 999, url: 'https://www.bewakoof.com' },
      { platform: 'flipkart', price: 629, originalPrice: 999, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=533&fit=crop',
  },
  {
    title: 'Reebok CrossFit Compression Tights',
    brand: 'Reebok',
    category: 'activewear',
    platforms: [
      { platform: 'myntra', price: 1999, originalPrice: 3499, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 2099, originalPrice: 3499, url: 'https://www.ajio.com' },
      { platform: 'flipkart', price: 2049, originalPrice: 3499, url: 'https://www.flipkart.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=533&fit=crop',
  },

  // ─── Luxury (8 products) ───
  {
    title: 'Raw Mango Handwoven Chanderi Saree',
    brand: 'Raw Mango',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 12999, originalPrice: 18999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 13499, originalPrice: 18999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 13299, originalPrice: 18999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558171813-7537213e15e5?w=400&h=533&fit=crop',
  },
  {
    title: 'Massimo Dutti Nappa Leather Jacket',
    brand: 'Massimo Dutti',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 14990, originalPrice: 19990, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 15990, originalPrice: 19990, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=533&fit=crop',
  },
  {
    title: 'Charles & Keith Premium Leather Handbag',
    brand: 'Charles & Keith',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 5999, originalPrice: 8999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 6299, originalPrice: 8999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 6199, originalPrice: 8999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=533&fit=crop',
  },
  {
    title: 'Mango Premium Cashmere Blend Coat',
    brand: 'Mango',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 9990, originalPrice: 14990, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 10490, originalPrice: 14990, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 10290, originalPrice: 14990, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=533&fit=crop',
  },
  {
    title: 'FableStreet Italian Wool Blazer Dress',
    brand: 'FableStreet',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 5999, originalPrice: 8999, url: 'https://www.myntra.com' },
      { platform: 'nykaa', price: 6299, originalPrice: 8999, url: 'https://www.nykaa.com' },
      { platform: 'ajio', price: 6199, originalPrice: 8999, url: 'https://www.ajio.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1487222477036-7d3a0a30c1c1?w=400&h=533&fit=crop',
  },
  {
    title: 'Aldo Premium Italian Leather Loafers',
    brand: 'Aldo',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 7999, originalPrice: 11999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 8499, originalPrice: 11999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 8299, originalPrice: 11999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=400&h=533&fit=crop',
  },
  {
    title: 'Hidesign Leather Messenger Bag - Vintage',
    brand: 'Hidesign',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 6499, originalPrice: 9995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 6799, originalPrice: 9995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 6699, originalPrice: 9995, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=533&fit=crop',
  },
  {
    title: 'Fossil Neutra Chronograph Stainless Steel Watch',
    brand: 'Fossil',
    category: 'luxury',
    platforms: [
      { platform: 'myntra', price: 8995, originalPrice: 12995, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 9295, originalPrice: 12995, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 9195, originalPrice: 12995, url: 'https://www.amazon.in' },
      { platform: 'tatacliq', price: 8895, originalPrice: 12995, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=533&fit=crop',
  },

  // ─── Wedding (8 products) ───
  {
    title: 'Sabyasachi Inspired Heavy Bridal Lehenga',
    brand: 'Kalki',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 24999, originalPrice: 39999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 25999, originalPrice: 39999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 25499, originalPrice: 39999, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=533&fit=crop',
  },
  {
    title: 'Manyavar Groom Silk Sherwani - Royal Maroon',
    brand: 'Manyavar',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 14999, originalPrice: 22999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 15499, originalPrice: 22999, url: 'https://www.flipkart.com' },
      { platform: 'tatacliq', price: 15299, originalPrice: 22999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=533&fit=crop',
  },
  {
    title: 'Tarun Tahiliani Inspired Anarkali Gown',
    brand: 'Kalki',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 18999, originalPrice: 29999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 19499, originalPrice: 29999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 19299, originalPrice: 29999, url: 'https://www.nykaa.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=533&fit=crop',
  },
  {
    title: 'Saree.com Pure Banarasi Bridal Silk Saree',
    brand: 'Saree.com',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 8999, originalPrice: 14999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 9499, originalPrice: 14999, url: 'https://www.flipkart.com' },
      { platform: 'meesho', price: 8499, originalPrice: 14999, url: 'https://www.meesho.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=533&fit=crop',
  },
  {
    title: 'Mohey Bridal Red Lehenga with Double Dupatta',
    brand: 'Mohey',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 19999, originalPrice: 32999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 20999, originalPrice: 32999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 20499, originalPrice: 32999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558171813-7537213e15e5?w=400&h=533&fit=crop',
  },
  {
    title: 'Manyavar Men Jacquard Kurta Pajama Set - Wedding',
    brand: 'Manyavar',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 5999, originalPrice: 9999, url: 'https://www.myntra.com' },
      { platform: 'flipkart', price: 6299, originalPrice: 9999, url: 'https://www.flipkart.com' },
      { platform: 'amazon', price: 6199, originalPrice: 9999, url: 'https://www.amazon.in' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=400&h=533&fit=crop',
  },
  {
    title: 'Kalki Sequin Embroidered Sharara Set - Ivory',
    brand: 'Kalki',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 12999, originalPrice: 19999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 13499, originalPrice: 19999, url: 'https://www.ajio.com' },
      { platform: 'nykaa', price: 13299, originalPrice: 19999, url: 'https://www.nykaa.com' },
      { platform: 'tatacliq', price: 13199, originalPrice: 19999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=533&fit=crop',
  },
  {
    title: 'Soch Heavy Zardozi Work Wedding Saree',
    brand: 'Soch',
    category: 'wedding',
    platforms: [
      { platform: 'myntra', price: 7999, originalPrice: 12999, url: 'https://www.myntra.com' },
      { platform: 'ajio', price: 8299, originalPrice: 12999, url: 'https://www.ajio.com' },
      { platform: 'tatacliq', price: 8199, originalPrice: 12999, url: 'https://www.tatacliq.com' },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=533&fit=crop',
  },
];

/** Combined full catalog */
export const ALL_SEED_PRODUCTS = [...SEED_PRODUCTS, ...SEED_PRODUCTS_EXTENDED, ...SEED_PRODUCTS_PREMIUM];
