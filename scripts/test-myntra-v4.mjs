import axios from 'axios';

const { data: html } = await axios.get('https://www.myntra.com/kurta-set-women', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  timeout: 15000,
});

// Extract all brands, products, prices, images separately — they appear in product-list order
const brands = [...html.matchAll(/"brand":"([^"]{2,40})"/g)].map(m => m[1]);
const productNames = [...html.matchAll(/"product":"([^"]{5,120})"/g)].map(m => m[1]);
const prices = [...html.matchAll(/"price":(\d{3,6})/g)].map(m => parseInt(m[1]));
const mrps = [...html.matchAll(/"mrp":(\d{3,6})/g)].map(m => parseInt(m[1]));
const images = [...html.matchAll(/"searchImage":"([^"]+)"/g)].map(m => m[1].replace(/\\u002F/g, '/'));

console.log('Brands:', brands.length);
console.log('Product names:', productNames.length);
console.log('Prices:', prices.length);
console.log('MRPs:', mrps.length);
console.log('Images:', images.length);

// They should be parallel arrays (same index = same product)
const count = Math.min(brands.length, productNames.length, prices.length, images.length, 15);
console.log(`\nCan pair: ${count} products\n`);

for (let i = 0; i < Math.min(count, 5); i++) {
  console.log(`${i+1}. ${brands[i]} ${productNames[i]}`);
  console.log(`   ₹${prices[i]} (MRP: ₹${mrps[i] || '?'})`);
  console.log(`   Image: ${images[i].substring(0, 80)}...`);
  console.log('');
}
