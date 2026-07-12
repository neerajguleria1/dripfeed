import axios from 'axios';

// Check account status
try {
  const {data} = await axios.get('https://api.scraperapi.com/account', {
    params: {api_key: '4b561812fdd7833b798e9b1fe8163a82'},
    timeout: 10000
  });
  console.log('Account status:', JSON.stringify(data, null, 2));
} catch(e) {
  console.log('Account check failed:', e?.response?.status, e?.response?.data || e?.message);
}

// Test a simple scrape (not structured)
try {
  const {data} = await axios.get('https://api.scraperapi.com/', {
    params: {
      api_key: '4b561812fdd7833b798e9b1fe8163a82',
      url: 'https://httpbin.org/get',
      render: false
    },
    timeout: 15000
  });
  console.log('\nSimple scrape: OK, got', typeof data, data?.url ? 'with url field' : '');
} catch(e) {
  console.log('\nSimple scrape failed:', e?.response?.status, e?.response?.data || e?.message);
}
