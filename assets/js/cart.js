import { PRODUCTS } from './products.js';
import { formatCondition, formatPrice } from './catalog-core.js';
import {
  CART_STORAGE_KEY,
  cartCount,
  normalizeCart,
  removeCartItem,
  setCartItemQuantity,
} from './cart-core.js';

function loadCart() {
  try {
    return normalizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function saveCart(cart) {
  const normalized = normalizeCart(cart);
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('mayionics:cart-changed', { detail: normalized }));
  return normalized;
}

function byId(id) {
  return PRODUCTS.find(product => product.id === id && product.status !== 'HIDDEN');
}

function render() {
  const target = document.querySelector('[data-cart-items]');
  if (!target) return;
  const empty = document.querySelector('[data-cart-empty]');
  const countLabel = document.querySelector('[data-cart-item-count]');
  const cart = loadCart();
  const rows = [];

  for (const item of cart) {
    const product = byId(item.product_id);
    const row = document.createElement('article');
    row.className = 'cart-row';
    row.dataset.productId = item.product_id;

    const details = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = product?.title || 'Unavailable item';
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = product
      ? `${formatCondition(product.condition)} · ${formatPrice(product.price_cents)} displayed from the catalog`
      : 'This product is no longer available in the public catalog.';
    details.append(title, meta);

    const controls = document.createElement('div');
    controls.className = 'cart-controls';
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '1';
    quantity.step = '1';
    quantity.value = String(item.quantity);
    quantity.setAttribute('aria-label', `Quantity for ${title.textContent}`);
    quantity.addEventListener('change', () => {
      const next = Number.parseInt(quantity.value, 10);
      saveCart(setCartItemQuantity(loadCart(), item.product_id, Number.isInteger(next) ? next : 0));
      render();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-secondary';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      saveCart(removeCartItem(loadCart(), item.product_id));
      render();
    });
    controls.append(quantity, remove);
    row.append(details, controls);
    rows.push(row);
  }

  target.replaceChildren(...rows);
  if (empty) empty.hidden = rows.length > 0;
  if (countLabel) countLabel.textContent = String(cartCount(cart));
}

render();
