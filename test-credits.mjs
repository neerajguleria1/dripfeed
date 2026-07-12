import axios from 'axios';

// ScraperAPI credit costs per their official docs:
// https://docs.scraperapi.com/making-requests/credit-cost
// Let's verify by checking what the account used vs requests made

try {
  const {data} = await axios.get('https://api.scraperapi.com/account', {
    params: {api_key: '4b561812fdd7833b798e9b1fe8163a82'},
    timeout: 10000
  });
  console.log('requestCount:', data.requestCount);
  console.log('requestLimit:', data.requestLimit);
  console.log('failedRequestCount:', data.failedRequestCount);
  console.log('creditsLeft:', data.creditsLeft);
  console.log('');
  // The test-100-queries.mjs ran:
  // - 36 Amazon structured calls (passed) + ~74 that got 403 (failed = no credit used)
  // - 0 Flipkart (all 403 after Amazon exhausted)
  // - 0 Myntra, 0 Google
  // So 36 Amazon structured calls used 5048 credits total from the account
  // But account started fresh on 2026-07-11, so we used 5048 credits total in this session
  // 5048 / 36 = ~140 credits per Amazon structured call? That can't be right
  // More likely the account was already partially used before our test
  console.log('Credits used in total session (not just our test):', data.requestLimit - data.creditsLeft);
} catch(e) {
  console.log('Failed:', e?.response?.data || e?.message);
}
