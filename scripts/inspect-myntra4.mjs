import * as fs from 'fs';

const html = fs.readFileSync('scripts/mn-full-kurtas.html', 'utf8');

// The products array is inside window.__myx.searchData.results.products
// Extract just the products array using regex
const productsMatch = html.match(/"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"(?:filters|totalCount|hasNextPage|derivedFilters|preferredFilters|collapsible)/);
if (!productsMatch) {
  console.log('Could not find products array with boundary regex');
  
  // Try simpler approach — find the products array start
  const start = html.indexOf('"products":[{');
  if (start < 0) {
    console.log('No "products":[{ found');
    // Check what's around the products key
    const pIdx = html.indexOf('"products"');
    console.log('products key at:', pIdx);
    if (pIdx > 0) console.log('Context:', html.slice(pIdx, pIdx + 200));
    process.exit(1);
  }
  console.log('Found products array at:', start);
  console.log('Context:', html.slice(start, start + 500));
  process.exit(1);
}

console.log('Found products array, length:', productsMatch[1].length);

// Parse the products array
let products;
try {
  products = JSON.parse(productsMatch[1]);
  console.log('Parsed', products.length, 'products');
} catch (e) {
  console.log('Parse error:', e.message);
  fs.writeFileSync('scripts/mn-products-raw.json', productsMatch[1].slice(0, 100000));
  console.log('Saved raw to mn-products-raw.json');
  process.exit(1);
}

// Show first product
console.log('\nFirst product keys:', Object.keys(products[0]).join(', '));
console.log('\nFull first product:');
console.log(JSON.stringify(products[0], null, 2));

// Audit
let missingName = 0, missingImg = 0, missingMrp = 0, missingSlug = 0, zeroPriceCount = 0;
for (const p of products) {
  if (!p.productName && !p.product) missingName++;
  if (!p.searchImage) missingImg++;
  if (!p.mrp) missingMrp++;
  if (!p.landingPageUrl) missingSlug++;
  const price = (p.mrp || 0) - (p.discount || 0);
  if (price <= 0) zeroPriceCount++;
}
console.log(`\nField audit (${products.length} products):`);
console.log(`  missing name: ${missingName}, missing image: ${missingImg}, missing mrp: ${missingMrp}, missing slug: ${missingSlug}, price<=0: ${zeroPriceCount}`);

// Image format
const imgFormats = {};
for (const p of products) {
  const img = p.searchImage || '';
  const fmt = img.startsWith('https://') ? 'https' : img.startsWith('http://') ? 'http' : 'other';
  imgFormats[fmt] = (imgFormats[fmt] || 0) + 1;
}
console.log('Image formats:', imgFormats);
console.log('First 3 images:', products.slice(0, 3).map(p => p.searchImage));

// Pricing
console.log('\nFirst 5 pricing:');
for (const p of products.slice(0, 5)) {
  const price = (p.mrp || 0) - (p.discount || 0);
  console.log(`  ${p.brand} ${p.productName} | mrp=${p.mrp} disc=${p.discount} price=${price}`);
}
