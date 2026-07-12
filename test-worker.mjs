import axios from 'axios';

// Try common subdomain patterns
const subdomains = [
  'dripfeed-proxy.amitashkumarrr.workers.dev',
];

const q = 'saree';
const myntraUrl = `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`;

for (const sub of subdomains) {
  console.log(`Testing https://${sub}...`);
  try {
    const { data } = await axios.get(`https://${sub}?url=${encodeURIComponent(myntraUrl)}`, { timeout: 10000 });
    console.log('✅ Worker reachable! Response:', JSON.stringify(data).slice(0, 200));
    break;
  } catch(e) {
    console.log(`❌ ${e?.response?.status || e?.code}`);
  }
}
