import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

const { data: html } = await axios.get('https://api.scraperapi.com/', {
  params: { api_key: key, url: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
  timeout: 15000
});

// Find all script tags with JSON data
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]{100,50000}?)<\/script>/g)];
console.log(`Found ${scripts.length} script tags`);

for (const [, content] of scripts) {
  if (content.includes('"name"') && content.includes('"price"') && content.includes('"image"')) {
    console.log('\n=== Found product-like script ===');
    console.log('Length:', content.length);
    console.log('Sample:', content.slice(0, 500));
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(content);
      console.log('Valid JSON! Keys:', Object.keys(json).slice(0, 10));
    } catch {
      // Try to find JSON object within
      const m = content.match(/(\{[\s\S]{200,})/);
      if (m) {
        console.log('JSON-like content found, first 300 chars:', m[1].slice(0, 300));
      }
    }
    break;
  }
}

// Also look for window.__ variables
const windowVars = [...html.matchAll(/window\.(\w+)\s*=\s*(\{[\s\S]{50,500})/g)];
console.log('\nwindow.* vars found:', windowVars.map(m => m[1]));

// Look for JSON-LD product schema
const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
console.log('\nJSON-LD scripts:', jsonLd.length);
for (const [, content] of jsonLd.slice(0, 2)) {
  try {
    const j = JSON.parse(content);
    console.log('JSON-LD type:', j['@type'], '| keys:', Object.keys(j).slice(0, 8));
    if (j['@type'] === 'ItemList' || j.itemListElement) {
      console.log('ItemList length:', j.itemListElement?.length);
      console.log('First item:', JSON.stringify(j.itemListElement?.[0]).slice(0, 200));
    }
  } catch { console.log('JSON-LD parse failed'); }
}
