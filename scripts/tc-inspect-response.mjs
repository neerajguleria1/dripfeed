import https from 'node:https';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
        'Accept': 'text/html,*/*',
        'Accept-Language': 'en-IN',
      },
      timeout: 20000
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const { status, body, headers } = await get(
  'https://www.tatacliq.com/search/?searchCategory=all&text=kurta'
);

console.log('HTTP Status:', status);
console.log('Content-Type:', headers['content-type']);
console.log('Content-Length:', headers['content-length'] ?? body.length);
console.log('\n--- First 2000 chars ---');
console.log(body.slice(0, 2000));
console.log('\n--- Key indicators ---');
console.log('Has __NEXT_DATA__:', body.includes('__NEXT_DATA__'));
console.log('Has "captcha":', body.toLowerCase().includes('captcha'));
console.log('Has "cloudflare":', body.toLowerCase().includes('cloudflare'));
console.log('Has "akamai":', body.toLowerCase().includes('akamai'));
console.log('Has "incapsula":', body.toLowerCase().includes('incapsula'));
console.log('Has "distil":', body.toLowerCase().includes('distil'));
console.log('Has "react":', body.toLowerCase().includes('react'));
console.log('Has "window.__":', body.includes('window.__'));
console.log('Has "<!DOCTYPE":', body.includes('<!DOCTYPE'));
console.log('Has "location.replace":', body.includes('location.replace'));
console.log('Has "cookie":', body.toLowerCase().includes('cookie'));
