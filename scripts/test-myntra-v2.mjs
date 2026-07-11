import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'en-IN,en;q=0.9',
};

const { data: html } = await axios.get('https://www.myntra.com/kurta-set-women', { headers: HEADERS, timeout: 15000 });
console.log('HTML length:', html.length);

// Strategy: find "searchData" and extract product list using targeted regex
// Myntra embeds product data like: "brand":"X","product":"Y","price":Z,"searchImage":"url"
const productRegex = /"brand":"([^"]+)","product":"([^"]+)"[^}]*?"price":(\d+)[^}]*?"searchImage":"([^"]+)"/g;
const products = [];
let m;
while ((m = productRegex.exec(html)) !== null) {
  products.push({
    brand: m[1],
    title: `${m[1]} ${m[2]}`,
    price: parseInt(m[3]),
    imageUrl: m[4],
  });
}

console.log('Products found via regex:', products.length);
if (products[0]) {
  console.log('\nSample 1:', products[0]);
  console.log('Sample 2:', products[1]);
  console.log('Sample 3:', products[2]);
}

// Also try: "mrp":X pattern nearby to get original prices
const mrpRegex = /"mrp":(\d+)[^}]*?"price":(\d+)/g;
const priceData = [];
while ((m = mrpRegex.exec(html)) !== null) {
  priceData.push({ mrp: parseInt(m[1]), price: parseInt(m[2]) });
}
console.log('\nMRP/Price pairs found:', priceData.length);
if (priceData[0]) console.log('Sample prices:', priceData.slice(0, 3));
