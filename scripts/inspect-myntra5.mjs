import * as fs from 'fs';

const html = fs.readFileSync('scripts/mn-full-kurtas.html', 'utf8');

// The JSON has \u002F escapes which are valid JSON but let's try a different approach
// Extract each product object individually using the landingPageUrl as anchor
// Each product starts with {"landingPageUrl": or has productId

// Strategy: find the products array boundaries and extract individual items
const productsStart = html.indexOf('"products":[{');
if (productsStart < 0) { console.log('No products array'); process.exit(1); }

console.log('Products array starts at:', productsStart);

// Extract individual product objects by finding balanced braces
function extractObjects(str, startIdx) {
  const objects = [];
  let i = startIdx;
  // Skip to first {
  while (i < str.length && str[i] !== '[') i++;
  i++; // skip [
  
  while (i < str.length) {
    if (str[i] === '{') {
      // Find matching }
      let depth = 0;
      let start = i;
      while (i < str.length) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
          depth--;
          if (depth === 0) {
            objects.push(str.slice(start, i + 1));
            i++;
            break;
          }
        }
        i++;
      }
    } else if (str[i] === ']') {
      break; // end of array
    } else {
      i++;
    }
  }
  return objects;
}

const rawObjects = extractObjects(html, productsStart + '"products":'.length);
console.log('Extracted', rawObjects.length, 'raw product objects');

// Parse each one
const products = [];
let parseErrors = 0;
for (const raw of rawObjects) {
  try {
    products.push(JSON.parse(raw));
  } catch (e) {
    parseErrors++;
    if (parseErrors <= 2) {
      console.log('Parse error on:', raw.slice(0, 200));
    }
  }
}
console.log('Parsed:', products.length, 'errors:', parseErrors);

if (products.length > 0) {
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
    const fmt = img.startsWith('https://') ? 'https' : img.startsWith('http://') ? 'http' : img.startsWith('\\u') ? 'escaped-unicode' : 'other';
    imgFormats[fmt] = (imgFormats[fmt] || 0) + 1;
  }
  console.log('Image formats:', imgFormats);
  console.log('First 3 images:', products.slice(0, 3).map(p => p.searchImage));
  
  // Pricing
  console.log('\nFirst 5 pricing:');
  for (const p of products.slice(0, 5)) {
    const price = (p.mrp || 0) - (p.discount || 0);
    console.log(`  ${p.brand} | ${p.productName} | mrp=${p.mrp} disc=${p.discount} price=${price}`);
  }
}
