import { describe, expect, it } from 'vitest';
import { parseMeeshoProducts } from '../../api/_lib/search.js';

describe('parseMeeshoProducts', () => {
  it('extracts product cards from Meesho HTML into normalized search products', () => {
    const html = `
      <html>
        <body>
          <div class="card">
            <a href="/adrika-refined-kurtis/p/589nid">
              <img src="https://images.example.com/kurti.jpg" />
              <span>Adrika Refined Kurtis</span>
              <span>₹313</span>
              <span>4.1 Star 105 Reviews</span>
            </a>
          </div>
          <div class="card">
            <a href="/women-rayon-kurti/p/123456">
              <img src="https://images.example.com/kurti2.jpg" />
              <span>Women Rayon Banita Alluring Kurtis</span>
              <span>₹335</span>
              <span>4.0 Star 12 Reviews</span>
            </a>
          </div>
          <a href="/category">Browse categories</a>
        </body>
      </html>
    `;

    const products = parseMeeshoProducts(html, 'kurta');

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      title: 'Adrika Refined Kurtis',
      price: 313,
      platform: 'Meesho',
      imageUrl: 'https://images.example.com/kurti.jpg',
      url: 'https://www.meesho.com/adrika-refined-kurtis/p/589nid',
    });
    expect(products[1]).toMatchObject({
      title: 'Women Rayon Banita Alluring Kurtis',
      price: 335,
      imageUrl: 'https://images.example.com/kurti2.jpg',
    });
  });

  it('strips Meesho\'s "+N More" color-variant badge text from titles', () => {
    const html = `
      <a href="/kurti/p/6dy8dt">
        <img src="https://images.example.com/kurti3.jpg" />
        <span>+8 MoreWomen Rayon Banita Alluring Kurtis</span>
        <span>₹197</span>
      </a>
    `;

    const products = parseMeeshoProducts(html, 'kurta');

    expect(products).toHaveLength(1);
    expect(products[0].title).toBe('Women Rayon Banita Alluring Kurtis');
  });
});
