import { PRODUCTS } from './products.js';
import {
  filterProducts,
  findProductBySlug,
  formatCondition,
  formatPrice,
  isPurchasable,
  publicProducts,
  sortProducts,
} from './catalog-core.js';
import { CART_STORAGE_KEY, addCartItem, normalizeCart } from './cart-core.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  return node;
}

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
}

function productMedia(product) {
  const image = product.images?.[0];
  if (image) {
    const img = el('img');
    img.src = image;
    img.alt = product.title;
    img.loading = 'lazy';
    img.className = 'catalog-image';
    return img;
  }
  const placeholder = el('div', { className: 'product-media' });
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

function productCard(product) {
  const article = el('article', { className: 'product-card' });
  const link = el('a', { className: 'product-card-link' });
  link.href = `/product.html?slug=${encodeURIComponent(product.slug)}`;
  link.append(productMedia(product));

  const body = el('div', { className: 'card-body' });
  body.append(
    el('p', { className: 'eyebrow', text: formatCondition(product.condition) }),
    el('h3', { text: product.title }),
    el('p', { className: 'catalog-price', text: formatPrice(product.price_cents) }),
  );
  link.append(body);
  article.append(link);
  return article;
}

function renderCards(target, products) {
  target.replaceChildren(...products.map(productCard));
}

function uniqueValues(products, key) {
  return [...new Set(products.map(product => product[key]).filter(Boolean))].sort();
}

function setOptions(select, values, allLabel, labeler = value => value) {
  if (!select) return;
  const current = select.value;
  const options = [new Option(allLabel, ''), ...values.map(value => new Option(labeler(value), value))];
  select.replaceChildren(...options);
  if ([...select.options].some(option => option.value === current)) select.value = current;
  select.disabled = false;
}

function renderShop() {
  const grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;

  const empty = document.querySelector('[data-catalog-empty]');
  const category = document.querySelector('[data-filter-category]');
  const condition = document.querySelector('[data-filter-condition]');
  const price = document.querySelector('[data-filter-price]');
  const sort = document.querySelector('[data-filter-sort]');
  const products = publicProducts(PRODUCTS);

  setOptions(category, uniqueValues(products, 'category'), 'All categories');
  setOptions(condition, uniqueValues(products, 'condition'), 'All conditions', formatCondition);
  if (price) price.disabled = false;
  if (sort) sort.disabled = false;

  const update = () => {
    const maxPrice = price?.value ? Number.parseInt(price.value, 10) : undefined;
    let result = filterProducts(PRODUCTS, {
      category: category?.value || undefined,
      condition: condition?.value || undefined,
      maxPriceCents: Number.isInteger(maxPrice) ? maxPrice : undefined,
    });
    result = sortProducts(result, sort?.value || 'newest');
    renderCards(grid, result);
    if (empty) empty.hidden = result.length > 0;
  };

  for (const control of [category, condition, price, sort]) control?.addEventListener('change', update);
  update();
}

function renderHomeCollection(selector, products) {
  const target = document.querySelector(selector);
  if (!target) return;
  renderCards(target, products);
  const empty = target.parentElement?.querySelector('[data-catalog-section-empty]');
  if (empty) empty.hidden = products.length > 0;
}

function renderHome() {
  const products = sortProducts(publicProducts(PRODUCTS), 'newest');
  renderHomeCollection('[data-new-arrivals]', products.slice(0, 4));
  renderHomeCollection('[data-featured-products]', products.filter(product => product.featured).slice(0, 4));
}

function appendProductImage(container, product) {
  const image = product.images?.[0];
  if (image) {
    const img = el('img', { className: 'product-detail-image' });
    img.src = image;
    img.alt = product.title;
    container.append(img);
  } else {
    const placeholder = el('div', { className: 'product-main-media' });
    placeholder.setAttribute('aria-hidden', 'true');
    container.append(placeholder);
  }
}

function addToCartControl(product) {
  const button = el('button', { className: 'button', text: 'Add to Cart' });
  button.type = 'button';
  button.setAttribute('data-add-to-cart', '');
  button.disabled = !isPurchasable(product);
  button.addEventListener('click', () => {
    saveCart(addCartItem(loadCart(), product.id, 1));
    button.textContent = 'Added to Cart';
    setTimeout(() => { button.textContent = 'Add to Cart'; }, 1200);
  });
  return button;
}

function renderProduct() {
  const target = document.querySelector('[data-product-detail]');
  if (!target) return;
  const slug = new URLSearchParams(window.location.search).get('slug');
  const product = findProductBySlug(PRODUCTS, slug);
  target.replaceChildren();

  if (!product) {
    const state = el('div', { className: 'empty-state' });
    state.append(
      el('h2', { text: slug ? 'Product not found' : 'Choose a product' }),
      el('p', { className: 'muted', text: slug ? 'This listing is unavailable or no longer public.' : 'Open a product from the Shop page to view its details.' }),
    );
    const back = el('a', { className: 'button', text: 'Browse Shop' });
    back.href = '/shop.html';
    state.append(back);
    target.append(state);
    return;
  }

  const gallery = el('div', { className: 'product-gallery' });
  appendProductImage(gallery, product);

  const summary = el('div', { className: 'product-summary' });
  summary.append(
    el('p', { className: 'eyebrow', text: product.category }),
    el('h1', { text: product.title }),
    el('span', { className: 'status-pill', text: formatCondition(product.condition) }),
    el('p', { className: 'price', text: formatPrice(product.price_cents) }),
    el('p', { className: 'muted', text: product.description }),
  );

  const availability = el('div', { className: 'panel' });
  availability.append(
    el('strong', { text: isPurchasable(product) ? 'Available' : 'Unavailable' }),
    el('p', {
      className: 'muted',
      text: isPurchasable(product)
        ? `${product.quantity} available. Inventory will be revalidated by the server before checkout.`
        : 'This item cannot currently be purchased.',
    }),
  );
  summary.append(availability, addToCartControl(product));

  target.append(gallery, summary);
}

renderShop();
renderHome();
renderProduct();
