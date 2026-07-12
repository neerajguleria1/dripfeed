import * as fs from 'fs';

const html = fs.readFileSync('scripts/mn-debug-kurtas.html', 'utf8');
console.log('File length:', html.length);

// Find productId
const idx = html.indexOf('productId');
console.log('First productId at index:', idx);
if (idx > 0) {
  console.log('\nContext around productId:');
  console.log(html.slice(Math.max(0, idx - 150), idx + 400));
}

// Count all occurrences
const allIds = [...html.matchAll(/productId/g)];
console.log('\nTotal productId occurrences:', allIds.length);

// Check if it's inside a script tag with JSON
const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('\nScript tags:', scriptMatches.length);
for (const s of scriptMatches) {
  if (s[1].includes('productId')) {
    console.log('\nScript containing productId (first 1000 chars):');
    console.log(s[1].slice(0, 1000));
    break;
  }
}

// Try to find the window state variable
const windowVars = [...html.matchAll(/window\.(\w+)\s*=/g)].map(m => m[1]);
console.log('\nwindow.* variables:', [...new Set(windowVars)].join(', '));

// Check for __INITIAL_STATE__ or similar
const statePatterns = ['__INITIAL_STATE__', '__REDUX_STATE__', '__STATE__', '__APP_STATE__', 'window.bundles', '__NEXT_DATA__'];
for (const p of statePatterns) {
  if (html.includes(p)) console.log(`Found: ${p}`);
}

// Find productName context
const nameIdx = html.indexOf('productName');
if (nameIdx > 0) {
  console.log('\nContext around productName:');
  console.log(html.slice(Math.max(0, nameIdx - 100), nameIdx + 300));
}

// Find searchImage context
const imgIdx = html.indexOf('searchImage');
if (imgIdx > 0) {
  console.log('\nContext around searchImage:');
  console.log(html.slice(Math.max(0, imgIdx - 100), imgIdx + 300));
}

// Check nesting depth at productId
const before = html.slice(0, idx);
const depth = (before.match(/\{/g)||[]).length - (before.match(/\}/g)||[]).length;
console.log('\nBrace depth at productId:', depth, '(means it is nested', depth, 'levels deep)');

// Try to extract a larger block containing productId
// Walk back to find the opening brace at depth-1
let pos = idx;
let targetDepth = depth - 1;
let currentDepth = depth;
let blockStart = -1;
for (let i = idx; i >= 0; i--) {
  if (html[i] === '}') currentDepth++;
  if (html[i] === '{') {
    currentDepth--;
    if (currentDepth === targetDepth) {
      blockStart = i;
      break;
    }
  }
}
if (blockStart >= 0) {
  console.log('\nProduct block starting at', blockStart, ':');
  console.log(html.slice(blockStart, blockStart + 800));
}
