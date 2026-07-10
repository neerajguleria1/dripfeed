import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-IN,en;q=0.9',
};

const query = 'kurta set women';

async function testMyntra() {
  console.log('\n--- MYNTRA ---');
  try {
    const slug = query.replace(/\s+/g, '-');
    const { data: html } = await axios.get(`https://www.myntra.com/${slug}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    // Check for __INITIAL_STATE__
    const hasState = html.includes('__INITIAL_STATE__') || html.includes('window.__myx');
    console.log('  Has state JSON:', hasState);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
    const imgs = [...html.matchAll(/src="(https:\/\/assets\.myntassets\.com[^"]+)"/g)].slice(0, 3).map(x => x[1]);
    console.log('  Myntra images:', imgs.length);
  } catch (e) { console.log('  ERROR:', e.message); }
}

async function testAjio() {
  console.log('\n--- AJIO ---');
  try {
    const { data: html } = await axios.get(`https://www.ajio.com/search/?text=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
  } catch (e) { console.log('  ERROR:', e.message); }
}

async function testAmazon() {
  console.log('\n--- AMAZON ---');
  try {
    const { data: html } = await axios.get(`https://www.amazon.in/s?k=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
    const titles = [...html.matchAll(/class="a-size-medium[^"]*"[^>]*>([^<]+)/g)].slice(0, 3).map(x => x[1]);
    console.log('  Titles:', titles);
    const imgs = [...html.matchAll(/src="(https:\/\/m\.media-amazon\.com[^"]+)"/g)].slice(0, 3);
    console.log('  Amazon images:', imgs.length);
  } catch (e) { console.log('  ERROR:', e.message); }
}

async function testMeesho() {
  console.log('\n--- MEESHO ---');
  try {
    const { data: html } = await axios.get(`https://www.meesho.com/search?q=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
  } catch (e) { console.log('  ERROR:', e.message); }
}

async function testNykaa() {
  console.log('\n--- NYKAA FASHION ---');
  try {
    const { data: html } = await axios.get(`https://www.nykaafashion.com/search?q=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
  } catch (e) { console.log('  ERROR:', e.message); }
}

async function testTataCliq() {
  console.log('\n--- TATA CLiQ ---');
  try {
    const { data: html } = await axios.get(`https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 12000 });
    console.log('  Length:', html.length);
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].slice(0, 5).map(x => x[1]);
    console.log('  Prices:', prices);
  } catch (e) { console.log('  ERROR:', e.message); }
}

console.log('Testing all 7 platforms for:', query);
await testMyntra();
await testAjio();
await testAmazon();
await testMeesho();
await testNykaa();
await testTataCliq();
console.log('\n✅ Flipkart already confirmed working');
