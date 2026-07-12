// verify-myntra-urls.mjs
const MYNTRA_500_SLUGS = new Set([
  'sarees','jeans','dresses','leggings','skirts','tops','shoes',
  'blazers','hoodies','pants','shorts','suits','coats','bags','watches',
  'heels','lehenga','lehnga','kurta-men','kurti-women','tops-women','kurtas','kurtis',
]);
const SLUG_MAP = {
  saree:'sarees',kurta:'kurtas',jean:'jeans',trouser:'trousers',
  legging:'leggings',dress:'dresses',skirt:'skirts',top:'tops',
  shoe:'footwear',sandal:'sandals',sneaker:'sneakers',boot:'boots',
  jacket:'jackets',blazer:'blazers',hoodie:'hoodies',shirt:'shirts',
  pant:'pants',short:'shorts',suit:'suits',coat:'coats',
  bag:'bags',watch:'watches',sari:'sarees',
};
function buildMyntraUrl(query) {
  const q = query.toLowerCase().trim();
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) return `search?q=${encodeURIComponent(q)}`;
  const BAD = new Set(['kurti','jean','kurtas','ladies','gents','women','men']);
  if (BAD.has(q)) return `search?q=${encodeURIComponent(q)}`;
  const BRANDS = new Set(['levis','zara','h&m','hm','puma','adidas','reebok','gap','mango','only','vero','forever','nike','bata','woodland','fastrack']);
  const words = q.split(' ');
  if (BRANDS.has(words[0])) {
    if (words.length >= 2) return `search?q=${encodeURIComponent(q)}`;
  }
  const corrected = SLUG_MAP[q] || q.replace(/\s+/g,'-');
  if (MYNTRA_500_SLUGS.has(corrected)) return `search?q=${encodeURIComponent(q)}`;
  if (/^(kurta|kurti|tops?)-/.test(corrected)) return `search?q=${encodeURIComponent(q)}`;
  return corrected;
}

const tests = [
  'heels',        // was → /heels (500), now → search?q=heels
  'tops women',   // was → /tops-women (500), now → search?q=tops+women
  'kurta men',    // was → /kurta-men (500), now → search?q=kurta+men
  'kurti women',  // was → /kurti-women (500), now → search?q=kurti+women
  'lehenga',      // was → /lehenga (500), now → search?q=lehenga
  'adidas shoes', // was → search?q=adidas+shoes (500), now → search?q=adidas+shoes (same, brand 500 is Myntra issue)
  // should still work as slugs:
  'sneakers', 'sports shoes', 'casual shoes', 'sandals',
  'jeans men', 'jeans women', 'dress women', 'salwar suit', 'sherwani men',
  'puma shoes', 'shoes under 1000',
];

for (const q of tests) {
  console.log(`${q.padEnd(25)} → ${buildMyntraUrl(q)}`);
}
