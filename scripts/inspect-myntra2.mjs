import axios from 'axios';
import * as fs from 'fs';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';

async function main() {
  console.log('Fetching Myntra kurtas page...');
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: KEY, url: 'https://www.myntra.com/kurtas', render: true, country_code: 'in' },
    timeout: 70000,
  });

  console.log('Response type:', typeof html);
  console.log('Response length:', html.length);

  // Save full file
  fs.writeFileSync('scripts/mn-full-kurtas.html', html);
  console.log('Saved full HTML to scripts/mn-full-kurtas.html');

  // Find productId
  const idx = html.indexOf('"productId"');
  console.log('First "productId" at index:', idx);
  if (idx > 0) {
    console.log('\nContext (300 before, 600 after):');
    console.log(html.slice(Math.max(0, idx - 300), idx + 600));
  }

  // Count all productId occurrences
  const allIds = [...html.matchAll(/"productId"\s*:\s*(\d+)/g)];
  console.log('\nTotal productId occurrences:', allIds.length);
  console.log('First 5 IDs:', allIds.slice(0, 5).map(m => m[1]).join(', '));

  // Check self-contained block regex
  const blocks = [...html.matchAll(/\{[^{}]*"productId"\s*:\s*\d+[^{}]*\}/g)];
  console.log('\nSelf-contained blocks (current regex):', blocks.length);
  if (blocks.length > 0) {
    console.log('First block:', blocks[0][0].slice(0, 300));
  }

  // Try a wider block regex (allows one level of nesting)
  const widerBlocks = [...html.matchAll(/\{(?:[^{}]|\{[^{}]*\})*"productId"\s*:\s*\d+(?:[^{}]|\{[^{}]*\})*\}/g)];
  console.log('\nWider blocks (1 level nesting):', widerBlocks.length);
  if (widerBlocks.length > 0) {
    console.log('First wider block:', widerBlocks[0][0].slice(0, 400));
  }

  // Check what's around productId — is it deeply nested?
  if (idx > 0) {
    const before = html.slice(0, idx);
    const depth = (before.match(/\{/g)||[]).length - (before.match(/\}/g)||[]).length;
    console.log('\nBrace depth at first productId:', depth);
  }

  // Find productName and searchImage
  const nameIdx = html.indexOf('"productName"');
  const imgIdx = html.indexOf('"searchImage"');
  const mrpIdx = html.indexOf('"mrp"');
  console.log('\nproductName at:', nameIdx);
  console.log('searchImage at:', imgIdx);
  console.log('mrp at:', mrpIdx);

  if (nameIdx > 0) {
    console.log('\nproductName context:', html.slice(nameIdx - 50, nameIdx + 200));
  }
  if (imgIdx > 0) {
    console.log('\nsearchImage context:', html.slice(imgIdx - 50, imgIdx + 200));
  }

  // Check window state variables
  const windowVars = [...html.matchAll(/window\.(\w+)\s*=/g)].map(m => m[1]);
  console.log('\nwindow.* vars:', [...new Set(windowVars)].join(', '));

  // Check for JSON data blobs
  const scriptTags = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('\nScript tags:', scriptTags.length);
  for (const s of scriptTags) {
    if (s[1].includes('productId') || s[1].includes('productName')) {
      console.log('\nScript with product data (first 500):');
      console.log(s[1].slice(0, 500));
      break;
    }
  }
}

main().catch(console.error);
