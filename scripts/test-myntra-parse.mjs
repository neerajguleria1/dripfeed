import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'en-IN,en;q=0.9',
};

const { data: html } = await axios.get('https://www.myntra.com/kurta-set-women', { headers: HEADERS, timeout: 15000 });

// Try different state patterns
const patterns = [
  /window\.__myx\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  /"searchData":\s*(\{[\s\S]*?"totalCount":\d+[\s\S]*?\})\s*[,}]/,
];

console.log('HTML length:', html.length);

for (const p of patterns) {
  const m = html.match(p);
  if (m) {
    console.log('\n✅ Pattern matched:', p.source.substring(0, 40));
    try {
      const data = JSON.parse(m[1]);
      const keys = Object.keys(data).slice(0, 10);
      console.log('Top keys:', keys);
      
      // Try to find products
      const products = data?.searchData?.results?.products 
        || data?.search?.results 
        || data?.products 
        || data?.results;
      
      if (products && Array.isArray(products)) {
        console.log('Products found:', products.length);
        console.log('Sample:', JSON.stringify(products[0], null, 2).substring(0, 500));
      }
    } catch (e) {
      console.log('Parse failed:', e.message.substring(0, 100));
    }
  }
}

// Also check for product data in script tags
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
const bigScripts = scripts.filter(s => s.length > 5000 && s.includes('product'));
console.log('\n\nBig scripts with "product":', bigScripts.length);
if (bigScripts[0]) {
  // Look for JSON objects with product-like structures
  const jsonMatch = bigScripts[0].match(/\{[^{]*"product"[^}]*\}/);
  if (jsonMatch) console.log('Found product JSON snippet:', jsonMatch[0].substring(0, 200));
}

// Check for structured product data in any format
const productPatterns = html.match(/"brand":"([^"]+)","product":"([^"]+)","price":(\d+)/g);
if (productPatterns) {
  console.log('\n\nDirect product matches:', productPatterns.length);
  console.log('Samples:', productPatterns.slice(0, 3));
}
