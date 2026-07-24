/**
 * vocab.ts
 *
 * Ecommerce vocabulary normalization dictionary.
 *
 * Maps common plural / variant surface forms to a single canonical token.
 * Applied per-token after tokenization, before sort+dedupe.
 *
 * ── Rules ─────────────────────────────────────────────────────────────────────
 *   • Keys   — lowercase surface forms that appear in scraped titles.
 *   • Values — the canonical form every key should collapse to.
 *   • Keep the list small and deliberate (~20–30 entries).
 *   • Add new entries here only — no logic changes required elsewhere.
 *
 * ── What this is NOT ──────────────────────────────────────────────────────────
 *   • Not a stemmer / lemmatizer.
 *   • Not a synonym dictionary.
 *   • Not NLP. Just a lookup table for known ecommerce vocabulary variants.
 */

export const VOCAB_MAP: Readonly<Record<string, string>> = {
  // ── Footwear ──────────────────────────────────────────────────────────────
  sneakers:  'sneaker',
  shoes:     'shoe',
  sandals:   'sandal',
  boots:     'boot',
  slippers:  'slipper',
  loafers:   'loafer',
  heels:     'heel',
  flats:     'flat',
  // ── Tops ──────────────────────────────────────────────────────────────────
  shirts:    'shirt',
  tshirts:   'tshirt',
  tops:      'top',
  blouses:   'blouse',
  // ── Bottoms ───────────────────────────────────────────────────────────────
  trousers:  'trouser',
  jeans:     'jean',
  shorts:    'short',
  joggers:   'jogger',
  leggings:  'legging',
  // ── Ethnic / South Asian ──────────────────────────────────────────────────
  kurtas:    'kurta',
  kurtis:    'kurti',
  sarees:    'saree',
  dupattas:  'dupatta',
  // ── Dresses / Outerwear ───────────────────────────────────────────────────
  dresses:   'dress',
  jackets:   'jacket',
  coats:     'coat',
  // ── Accessories ───────────────────────────────────────────────────────────
  watches:   'watch',
  bags:      'bag',
};
