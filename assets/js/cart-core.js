export const CART_STORAGE_KEY = 'mayionics.cart.v1';

function validProductId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validQuantity(value) {
  return Number.isInteger(value) && value > 0;
}

export function normalizeCart(input) {
  if (!Array.isArray(input)) return [];
  const merged = new Map();
  for (const item of input) {
    if (!item || !validProductId(item.product_id) || !validQuantity(item.quantity)) continue;
    const productId = item.product_id.trim();
    merged.set(productId, (merged.get(productId) || 0) + item.quantity);
  }
  return [...merged.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

export function addCartItem(cart, productId, quantity = 1) {
  if (!validProductId(productId) || !validQuantity(quantity)) return normalizeCart(cart);
  return normalizeCart([...normalizeCart(cart), { product_id: productId.trim(), quantity }]);
}

export function setCartItemQuantity(cart, productId, quantity) {
  const normalized = normalizeCart(cart);
  if (!validProductId(productId)) return normalized;
  const id = productId.trim();
  if (!validQuantity(quantity)) return normalized.filter(item => item.product_id !== id);
  let found = false;
  const result = normalized.map(item => {
    if (item.product_id !== id) return item;
    found = true;
    return { product_id: id, quantity };
  });
  if (!found) result.push({ product_id: id, quantity });
  return result;
}

export function removeCartItem(cart, productId) {
  if (!validProductId(productId)) return normalizeCart(cart);
  const id = productId.trim();
  return normalizeCart(cart).filter(item => item.product_id !== id);
}

export function cartCount(cart) {
  return normalizeCart(cart).reduce((sum, item) => sum + item.quantity, 0);
}
