const fs = require('fs');
const s = fs.readFileSync('old_search2.txt', 'utf8');
const i = s.indexOf('async function fetchAmazonPage');
const j = s.indexOf('async function fetchFlipkart');
console.log(s.slice(i, j));
