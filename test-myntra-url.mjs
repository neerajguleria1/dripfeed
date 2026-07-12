import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const SCRAPER_KEY = process.env.SCRAPER_API_KEY;

function cleanText(t) {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
}

async function testMyntraUrl(url) {
  console.log(`\nTesting: ${url}`);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: SCRAPER_KEY, url, render: true, country_code: 'in' },
      timeout: 65000,
    });
    const ids    = [...html.matchAll(/"productId"\s*:\s*(\d+)/g)].map(m => m[1]);
    const names  = [...html.matchAll(/"productName"\s*:\s*"([^"]+)"/g)].map(m => cleanText(m[1]));
    const mrps   = [...html.matchAll(/"mrp"\s*:\s*(\d+)/g)].map(m => parseInt(m[1]));
    const images = [...html.matchAll(/"searchImage"\s*:\s*"((?:http|https):[^"]+)"/g)].map(m => m[1]);
    console.log(`ids:${ids.length} names:${names.length} mrps:${mrps.length} images:${images.length}`);
    if (names.length > 0) console.log(`  Sample: ${names[0]?.slice(0, 50)}`);
  } catch(e) { console.log(`❌ ${e.message?.slice(0, 60)}`); }
}

// Current approach — hyphenated slug
await testMyntraUrl('https://www.myntra.com/trousers-women');

// Myntra search page
await testMyntraUrl('https://www.myntra.com/trousers?rawQuery=trousers+women');

// Myntra search endpoint
await testMyntraUrl('https://www.myntra.com/search?q=trousers+women');

// Just the first word
await testMyntraUrl('https://www.myntra.com/trousers');
