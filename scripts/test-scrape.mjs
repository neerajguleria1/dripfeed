import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-IN,en;q=0.9',
};

async function testFlipkart() {
  console.log('Testing Flipkart...');
  const { data: html } = await axios.get('https://www.flipkart.com/search?q=kurta+set+women', { headers: HEADERS, timeout: 15000 });
  console.log('  HTML length:', html.length);

  // Find product titles via alt attributes on product images
  const alts = [...html.matchAll(/alt="([^"]{10,120})"/g)]
    .map(x => x[1])
    .filter(a => !a.includes('Flipkart') && !a.includes('banner') && !a.includes('icon') && a.length > 15);
  console.log('  Product titles (alt):', alts.slice(0, 5));

  // Find prices
  const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].map(x => parseInt(x[1].replace(/,/g, ''), 10)).filter(p => p > 100 && p < 50000);
  console.log('  Prices:', prices.slice(0, 10));

  // Find images (Flipkart CDN)
  const imgs = [...html.matchAll(/src="(https:\/\/rukminim[^"]+)"/g)].map(x => x[1]);
  console.log('  Images:', imgs.length);

  // Find product links
  const links = [...html.matchAll(/href="(\/[^"]*\/p\/[^"]+)"/g)].map(x => 'https://www.flipkart.com' + x[1]);
  console.log('  Product links:', links.slice(0, 3));

  // Combine into products
  const products = [];
  for (let i = 0; i < Math.min(alts.length, prices.length, 10); i++) {
    products.push({
      title: alts[i],
      price: prices[i],
      imageUrl: imgs[i] || '',
      url: links[i] || 'https://www.flipkart.com',
      platform: 'Flipkart',
    });
  }
  console.log('\n  Combined products:', products.length);
  if (products[0]) console.log('  Sample:', products[0]);
  return products;
}

testFlipkart().catch(e => console.error('Error:', e.message));
