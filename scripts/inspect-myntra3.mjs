import * as fs from 'fs';

const html = fs.readFileSync('scripts/mn-full-kurtas.html', 'utf8');

// Extract window.__myx JSON
const myxMatch = html.match(/window\.__myx\s*=\s*(\{[\s\S]*?);\s*(?:window\.|<\/script>)/);
if (!myxMatch) {
  console.log('No window.__myx found');
  // Try alternate
  const alt = html.match(/window\.__myx\s*=\s*(\{)/);
  console.log('Alt match:', alt ? 'found start' : 'not found');
  process.exit(1);
}

console.log('Found window.__myx, length:', myxMatch[1].length);

// Parse it
let myx;
try {
  myx = JSON.parse(myxMatch[1]);
  console.log('Parsed successfully');
} catch (e) {
  console.log('Parse error:', e.message);
  // Save the raw JSON for inspection
  fs.writeFileSync('scripts/mn-myx.json', myxMatch[1].slice(0, 50000));
  console.log('Saved first 50k to mn-myx.json');
  process.exit(1);
}

// Navigate to products
const results = myx?.searchData?.results;
console.log('\nsearchData.results keys:', Object.keys(results || {}).join(', '));
console.log('totalCount:', results?.totalCount);

const products = results?.products || [];
console.log('products count:', products.length);

if (products.length > 0) {
  const p = products[0];
  console.log('\nFirst product keys:', Object.keys(p).join(', '));
  console.log('\nFull first product:');
  console.log(JSON.stringify(p, null, 2));
}

// Check all products for field completeness
let missingName = 0, missingImg = 0, missingMrp = 0, missingSlug = 0, zeroPriceCount = 0;
for (const p of products) {
  if (!p.productName && !p.product) missingName++;
  if (!p.searchImage) missingImg++;
  if (!p.mrp) missingMrp++;
  if (!p.landingPageUrl) missingSlug++;
  const mrp = p.mrp || 0;
  const disc = p.discount || 0;
  const price = mrp - disc;
  if (price <= 0) zeroPriceCount++;
}
console.log(`\nField audit (${products.length} products):`);
console.log(`  missing name: ${missingName}`);
console.log(`  missing image: ${missingImg}`);
console.log(`  missing mrp: ${missingMrp}`);
console.log(`  missing slug: ${missingSlug}`);
console.log(`  price<=0: ${zeroPriceCount}`);

// Check image URL format
const imgFormats = {};
for (const p of products) {
  const img = p.searchImage || '';
  const fmt = img.startsWith('https://') ? 'https' : img.startsWith('http://') ? 'http' : img.startsWith('\\u') ? 'escaped' : 'other';
  imgFormats[fmt] = (imgFormats[fmt] || 0) + 1;
}
console.log('\nImage URL formats:', imgFormats);

// Show a few image URLs
console.log('\nFirst 3 image URLs:');
for (const p of products.slice(0, 3)) {
  console.log(' ', p.searchImage);
}

// Check discount field — is it amount or percentage?
console.log('\nFirst 3 pricing:');
for (const p of products.slice(0, 3)) {
  console.log(`  mrp=${p.mrp}, discount=${p.discount}, price=${p.mrp - p.discount}, discountDisplayLabel=${p.discountDisplayLabel}`);
}
