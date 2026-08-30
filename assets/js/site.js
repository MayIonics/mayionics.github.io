import { CART_STORAGE_KEY, cartCount, normalizeCart } from './cart-core.js';

function loadCart() {
  try {
    return normalizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function updateCartCount(cart = loadCart()) {
  for (const node of document.querySelectorAll('#cart-count')) {
    node.textContent = String(cartCount(cart));
  }
}

updateCartCount();
window.addEventListener('storage', event => {
  if (event.key === CART_STORAGE_KEY) updateCartCount();
});
window.addEventListener('mayionics:cart-changed', event => updateCartCount(event.detail));
