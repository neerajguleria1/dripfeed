import { readFileSync } from 'fs';

const html = readFileSync('./meesho_test.html', 'utf-8');

function cleanText(t) {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}
function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  if (url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}
function parsePrice(t) {
  if (typeof t === 'number') return Math.round(t);
  const cleaned = String(t).replace(/[^\d.]/g, '');
  return Math.round(parseFloat(cleaned) || 0);
}

function parseMeeshoProducts(html, query) {
  const root = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const cardRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const products = [];
  const seen = new Set();

  let match;
  let count = 0;
  while ((match = cardRe.exec(root))) {
    count++;
    const href = match[1] || '';
    const inner = match[2] || '';
    if (!href || !href.includes('/p/')) continue;

    const priceMatch = inner.match(/₹\s?([0-9,]+(?:\.\d{1,2})?)/i) || inner.match(/\b([0-9,]+(?:\.\d{1,2})?)\b/);
    const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
    const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    const imageUrl = toAbsoluteUrl(imgMatch?.[1] || '');

    const withoutImg = inner.replace(/<img[^>]*>/gi, '');
    const beforePrice = withoutImg.split(/₹\s?[0-9,]/)[0];
    const rawTitle = cleanText(beforePrice);
    const normalizedTitle = rawTitle
      .replace(/\s+/g, ' ')
      .replace(/\d+(\.\d+)?\s*star.*$/i, '')
      .trim();

    if (!normalizedTitle || price <= 0 || !imageUrl) continue;
    const key = `${normalizedTitle.toLowerCase()}::${price}`;
    if (seen.has(key)) continue;
    seen.add(key);

    products.push({ title: normalizedTitle, price, imageUrl, url: href });
  }

  console.log('Total <a> tags scanned:', count);
  return products;
}

const results = parseMeeshoProducts(html, 'kurta');
console.log('Products extracted:', results.length);
console.log(JSON.stringify(results.slice(0, 5), null, 2));
