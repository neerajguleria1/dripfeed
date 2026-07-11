import axios from 'axios';

const { data: html } = await axios.get('https://www.myntra.com/kurta-set-women', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  timeout: 15000,
});

// Find product data: pattern is "product":"<name>"...,"brand":"<brand>"...,"price":<num>...,"searchImage":"<url>"
// But order varies. Let's extract using individual field matches near each other.

// Strategy: find all "searchImage" occurrences, then look backwards and forwards for brand, product, price
const searchImagePositions = [];
let pos = 0;
while ((pos = html.indexOf('"searchImage":', pos)) !== -1) {
  searchImagePositions.push(pos);
  pos += 15;
}

console.log('searchImage occurrences:', searchImagePositions.length);

const products = [];
for (const imgPos of searchImagePositions.slice(0, 20)) {
  // Get a window of ~1000 chars around the searchImage
  const start = Math.max(0, imgPos - 800);
  const end = Math.min(html.length, imgPos + 400);
  const chunk = html.substring(start, end);

  // Extract fields from this chunk
  const brand = chunk.match(/"brand":"([^"]+)"/)?.[1] || '';
  const product = chunk.match(/"product":"([^"]+)"/)?.[1] || '';
  const price = chunk.match(/"price":(\d+)/)?.[1];
  const mrp = chunk.match(/"mrp":(\d+)/)?.[1];
  const searchImage = chunk.match(/"searchImage":"([^"]+)"/)?.[1]?.replace(/\\u002F/g, '/') || '';
  const landingPage = chunk.match(/"landingPageUrl":"([^"]+)"/)?.[1] || '';

  if (brand && product && price && searchImage) {
    products.push({
      title: `${brand} ${product}`,
      brand,
      price: parseInt(price),
      originalPrice: mrp ? parseInt(mrp) : undefined,
      imageUrl: searchImage.startsWith('http') ? searchImage : `https://assets.myntassets.com/${searchImage}`,
      url: `https://www.myntra.com/${landingPage}`,
      platform: 'Myntra',
    });
  }
}

console.log('Products extracted:', products.length);
console.log('\nSample 1:', products[0]);
console.log('Sample 2:', products[1]);
console.log('Sample 3:', products[2]);
