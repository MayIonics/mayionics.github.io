const statusBox = document.querySelector('[data-admin-status]');
const panel = document.querySelector('[data-admin-panel]');
const form = document.querySelector('[data-product-form]');
const message = document.querySelector('[data-admin-message]');
const list = document.querySelector('[data-product-list]');

const isGithubPages = location.hostname.endsWith('github.io');
let products = [];

function setStatus(text) {
  if (statusBox) statusBox.textContent = text;
}

function setMessage(text) {
  if (message) message.textContent = text;
}

function numberOrNull(value) {
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function productFromForm() {
  const data = new FormData(form);
  return {
    slug: String(data.get('slug') || '').trim(),
    title: String(data.get('title') || '').trim(),
    description: String(data.get('description') || '').trim(),
    price_cents: Number(data.get('price_cents')),
    quantity: Number(data.get('quantity')),
    condition: String(data.get('condition') || ''),
    category: String(data.get('category') || '').trim(),
    images: String(data.get('images') || '').split('\n').map(value => value.trim()).filter(Boolean),
    weight_oz: numberOrNull(data.get('weight_oz')),
    length_in: numberOrNull(data.get('length_in')),
    width_in: numberOrNull(data.get('width_in')),
    height_in: numberOrNull(data.get('height_in')),
    status: String(data.get('status') || ''),
    featured: data.get('featured') === 'on',
  };
}

function fillForm(product) {
  form.elements.slug.value = product.slug;
  form.elements.title.value = product.title;
  form.elements.description.value = product.description;
  form.elements.price_cents.value = product.price_cents;
  form.elements.quantity.value = product.quantity;
  form.elements.condition.value = product.condition;
  form.elements.category.value = product.category;
  form.elements.images.value = (product.images || []).join('\n');
  form.elements.weight_oz.value = product.weight_oz ?? '';
  form.elements.length_in.value = product.length_in ?? '';
  form.elements.width_in.value = product.width_in ?? '';
  form.elements.height_in.value = product.height_in ?? '';
  form.elements.status.value = product.status;
  form.elements.featured.checked = Boolean(product.featured);
  form.dataset.editingId = product.id;
  form.querySelector('button[type="submit"]').textContent = 'Update Product';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  form.reset();
  form.elements.quantity.value = '1';
  form.elements.status.value = 'ACTIVE';
  delete form.dataset.editingId;
  form.querySelector('button[type="submit"]').textContent = 'Create Product';
}

function button(text, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'button-secondary';
  node.textContent = text;
  node.addEventListener('click', action);
  return node;
}

function renderProducts() {
  if (!list) return;
  list.replaceChildren();
  if (!products.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No products are currently stored.';
    list.append(empty);
    return;
  }

  for (const product of products) {
    const card = document.createElement('article');
    card.className = 'panel';
    const title = document.createElement('h3');
    title.textContent = product.title;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `${product.status} · ${product.quantity} available · $${(product.price_cents / 100).toFixed(2)}`;
    const actions = document.createElement('div');
    actions.append(
      button('Edit', () => fillForm(product)),
      button('Hide', async () => {
        if (product.status === 'HIDDEN') return;
        const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/hide`, { method: 'POST' });
        if (!response.ok) {
          setMessage(`Unable to hide product (${response.status}).`);
          return;
        }
        setMessage('Product hidden.');
        await loadProducts();
      }),
    );
    card.append(title, meta, actions);
    list.append(card);
  }
}

async function loadProducts() {
  const response = await fetch('/api/admin/products', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Admin API returned ${response.status}`);
  const body = await response.json();
  products = Array.isArray(body.products) ? body.products : [];
  renderProducts();
}

if (isGithubPages) {
  setStatus('Admin management is intentionally unavailable on the public GitHub Pages development host. Cloudflare Access and the protected Worker API must be deployed first.');
} else {
  panel.hidden = false;
  setStatus('Protected admin environment. Cloudflare Access authentication is required for every API request.');
  loadProducts().catch(error => setMessage(error.message));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('Saving…');
    const id = form.dataset.editingId;
    const response = await fetch(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(productFromForm()),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.details?.join('; ') || body.error || `Unable to save product (${response.status}).`);
      return;
    }
    setMessage(id ? 'Product updated.' : 'Product created.');
    resetForm();
    await loadProducts();
  });
}
