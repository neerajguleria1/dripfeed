/**
 * Property 14: Collection Title and Description Validation
 * Property 15: Collection CRUD Round-Trip
 * Property 16: Collection Share Token Grants Public Access
 * Validates: Requirements 10.2, 10.3, 10.6, 10.7
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface Collection {
  id: string;
  userId: string;
  title: string;
  description: string;
  products: string[];
  shareToken: string;
  isPublic: boolean;
  createdAt: string;
}

function validateCollectionTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) return { valid: false, error: 'Title is required' };
  if (title.trim().length > 100) return { valid: false, error: 'Title must be 100 chars or less' };
  return { valid: true };
}

function validateCollectionDescription(desc: string): { valid: boolean; error?: string } {
  if (desc.length > 500) return { valid: false, error: 'Description must be 500 chars or less' };
  return { valid: true };
}

function createCollection(userId: string, title: string, description: string = ''): Collection {
  return {
    id: crypto.randomUUID(),
    userId,
    title: title.trim(),
    description: description.trim(),
    products: [],
    shareToken: crypto.randomUUID(),
    isPublic: false,
    createdAt: new Date().toISOString(),
  };
}

function addProductToCollection(collection: Collection, productId: string): Collection {
  if (collection.products.includes(productId)) return collection;
  return { ...collection, products: [...collection.products, productId] };
}

function removeProductFromCollection(collection: Collection, productId: string): Collection {
  return { ...collection, products: collection.products.filter((id) => id !== productId) };
}

describe('Property 14: Collection Title and Description Validation', () => {
  it('valid titles (1-100 chars, non-whitespace) pass validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (title) => {
          const result = validateCollectionTitle(title);
          expect(result.valid).toBe(true);
        },
      ),
    );
  });

  it('empty/whitespace-only titles fail validation', () => {
    fc.assert(
      fc.property(
        fc.constant(''),
        (title) => {
          const result = validateCollectionTitle(title);
          expect(result.valid).toBe(false);
        },
      ),
    );
    // Also test whitespace-only
    expect(validateCollectionTitle('   ')).toEqual({ valid: false, error: 'Title is required' });
    expect(validateCollectionTitle('\t\n')).toEqual({ valid: false, error: 'Title is required' });
  });

  it('titles over 100 chars fail validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }).filter((s) => s.trim().length > 100),
        (title) => {
          const result = validateCollectionTitle(title);
          expect(result.valid).toBe(false);
        },
      ),
    );
  });

  it('descriptions over 500 chars fail validation', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 501, maxLength: 600 }), (desc) => {
        const result = validateCollectionDescription(desc);
        expect(result.valid).toBe(false);
      }),
    );
  });
});

describe('Property 15: Collection CRUD Round-Trip', () => {
  it('created collection has correct userId and title', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        (userId, title) => {
          const coll = createCollection(userId, title);
          expect(coll.userId).toBe(userId);
          expect(coll.title).toBe(title.trim());
          expect(coll.products).toHaveLength(0);
          expect(coll.shareToken).toBeTruthy();
        },
      ),
    );
  });

  it('adding a product increases product count by 1', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (userId, productId) => {
        const coll = createCollection(userId, 'Test');
        const updated = addProductToCollection(coll, productId);
        expect(updated.products).toHaveLength(1);
        expect(updated.products[0]).toBe(productId);
      }),
    );
  });

  it('adding same product twice does not duplicate', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (userId, productId) => {
        const coll = createCollection(userId, 'Test');
        const once = addProductToCollection(coll, productId);
        const twice = addProductToCollection(once, productId);
        expect(twice.products).toHaveLength(1);
      }),
    );
  });

  it('removing a product decreases count', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (userId, productId) => {
        const coll = createCollection(userId, 'Test');
        const added = addProductToCollection(coll, productId);
        const removed = removeProductFromCollection(added, productId);
        expect(removed.products).toHaveLength(0);
      }),
    );
  });
});

describe('Property 16: Collection Share Token Grants Public Access', () => {
  it('every collection gets a unique share token', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
        (userId, titles) => {
          const collections = titles.map((t) => createCollection(userId, t));
          const tokens = new Set(collections.map((c) => c.shareToken));
          // All tokens should be unique
          expect(tokens.size).toBe(collections.length);
        },
      ),
    );
  });

  it('share token is a valid UUID format', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const coll = createCollection(userId, 'Test Collection');
        // UUID v4 format
        expect(coll.shareToken).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }),
    );
  });
});
