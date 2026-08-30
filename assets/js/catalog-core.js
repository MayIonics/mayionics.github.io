const CONDITIONS = new Set(['NEW', 'OPEN_BOX', 'PRE_OWNED']);
const STATUSES = new Set(['ACTIVE', 'RESERVED', 'SOLD', 'HIDDEN']);

export function validateProduct(product) {
  const errors = [];
  if (!product || typeof product !== 'object') return { valid: false, errors: ['product must be an object'] };

  for (const field of ['id', 'slug', 'title', 'description', 'category', 'created_at']) {
    if (typeof product[field] !== 'string' || !product[field].trim()) errors.push(`${field} must be a non-empty string`);
  }
  if (!Number.isInteger(product.price_cents) || product.price_cents < 0) errors.push('price_cents must be a non-negative integer');
  if (!Number.isInteger(product.quantity) || product.quantity < 0) errors.push('quantity must be a non-negative integer');
  if (!CONDITIONS.has(product.condition)) errors.push('condition is invalid');
  if (!STATUSES.has(product.status)) errors.push('status is invalid');
  if (!Array.isArray(product.images)) errors.push('images must be an array');
  if (typeof product.featured !== 'boolean') errors.push('featured must be boolean');

  return { valid: errors.length === 0, errors };
}

export function formatPrice(cents) {
  if (!Number.isInteger(cents) || cents < 0) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function formatCondition(condition) {
  return ({ NEW: 'New', OPEN_BOX: 'Open Box', PRE_OWNED: 'Pre-Owned' })[condition] ?? '';
}

export function isPurchasable(product) {
  return validateProduct(product).valid && product.status === 'ACTIVE' && product.quantity > 0;
}

export function publicProducts(products) {
  return products.filter(isPurchasable);
}

export function filterProducts(products, filters = {}) {
  let result = publicProducts(products);
  if (filters.category) result = result.filter(product => product.category === filters.category);
  if (filters.condition) result = result.filter(product => product.condition === filters.condition);
  if (Number.isInteger(filters.maxPriceCents) && filters.maxPriceCents >= 0) {
    result = result.filter(product => product.price_cents <= filters.maxPriceCents);
  }
  return result;
}

export function sortProducts(products, sort = 'newest') {
  const result = [...products];
  if (sort === 'price-asc') return result.sort((a, b) => a.price_cents - b.price_cents || a.title.localeCompare(b.title));
  if (sort === 'price-desc') return result.sort((a, b) => b.price_cents - a.price_cents || a.title.localeCompare(b.title));
  if (sort === 'title') return result.sort((a, b) => a.title.localeCompare(b.title));
  return result.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function findProductBySlug(products, slug) {
  if (!slug) return null;
  const product = products.find(item => item?.slug === slug);
  if (!product || !validateProduct(product).valid || product.status === 'HIDDEN') return null;
  return product;
}
