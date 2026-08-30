const CONDITIONS = new Set(['NEW', 'OPEN_BOX', 'PRE_OWNED']);
const STATUSES = new Set(['ACTIVE', 'RESERVED', 'SOLD', 'HIDDEN']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function positiveOptionalNumber(value, field, errors) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    errors.push(`${field} must be a positive number when provided`);
    return null;
  }
  return value;
}

export function validateAdminProductInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['product must be an object'] };

  for (const field of ['slug', 'title', 'description', 'category']) {
    if (typeof input[field] !== 'string' || !input[field].trim()) errors.push(`${field} must be a non-empty string`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug ?? '')) errors.push('slug must use lowercase letters, numbers, and hyphens');
  if (!Number.isInteger(input.price_cents) || input.price_cents < 0) errors.push('price_cents must be a non-negative integer');
  if (!Number.isInteger(input.quantity) || input.quantity < 0) errors.push('quantity must be a non-negative integer');
  if (!CONDITIONS.has(input.condition)) errors.push('condition is invalid');
  if (!STATUSES.has(input.status)) errors.push('status is invalid');
  if (!Array.isArray(input.images) || input.images.some(image => typeof image !== 'string' || !image.trim())) errors.push('images must be an array of non-empty strings');
  if (typeof input.featured !== 'boolean') errors.push('featured must be boolean');

  const dimensions = {
    weight_oz: positiveOptionalNumber(input.weight_oz, 'weight_oz', errors),
    length_in: positiveOptionalNumber(input.length_in, 'length_in', errors),
    width_in: positiveOptionalNumber(input.width_in, 'width_in', errors),
    height_in: positiveOptionalNumber(input.height_in, 'height_in', errors),
  };

  return {
    valid: errors.length === 0,
    errors,
    product: errors.length ? null : {
      slug: input.slug.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      price_cents: input.price_cents,
      quantity: input.quantity,
      condition: input.condition,
      category: input.category.trim(),
      images: input.images.map(image => image.trim()),
      ...dimensions,
      status: input.status,
      featured: input.featured,
    },
  };
}

function rowToProduct(row) {
  let images = [];
  try { images = JSON.parse(row.image_data || '[]'); } catch { images = []; }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price_cents: row.price_cents,
    quantity: row.quantity,
    condition: row.condition,
    category: row.category,
    images: Array.isArray(images) ? images : [],
    weight_oz: row.weight_oz,
    length_in: row.length_in,
    width_in: row.width_in,
    height_in: row.height_in,
    status: row.status,
    featured: Boolean(row.featured),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function listProducts(db) {
  const result = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  return json({ products: (result.results ?? []).map(rowToProduct) });
}

async function createProduct(request, db) {
  const parsed = validateAdminProductInput(await bodyJson(request));
  if (!parsed.valid) return json({ error: 'invalid_product', details: parsed.errors }, 400);
  const product = parsed.product;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO products (
        id, slug, title, description, price_cents, quantity, condition, category, image_data,
        weight_oz, length_in, width_in, height_in, status, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, product.slug, product.title, product.description, product.price_cents, product.quantity,
      product.condition, product.category, JSON.stringify(product.images), product.weight_oz,
      product.length_in, product.width_in, product.height_in, product.status, product.featured ? 1 : 0,
      now, now,
    ).run();
  } catch (error) {
    if (String(error?.message ?? error).toLowerCase().includes('unique')) return json({ error: 'product_conflict' }, 409);
    throw error;
  }
  return json({ product: { id, ...product, created_at: now, updated_at: now } }, 201);
}

async function updateProduct(request, db, id) {
  const parsed = validateAdminProductInput(await bodyJson(request));
  if (!parsed.valid) return json({ error: 'invalid_product', details: parsed.errors }, 400);
  const product = parsed.product;
  const now = new Date().toISOString();

  let result;
  try {
    result = await db.prepare(`
      UPDATE products SET
        slug = ?, title = ?, description = ?, price_cents = ?, quantity = ?, condition = ?, category = ?,
        image_data = ?, weight_oz = ?, length_in = ?, width_in = ?, height_in = ?, status = ?, featured = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      product.slug, product.title, product.description, product.price_cents, product.quantity, product.condition,
      product.category, JSON.stringify(product.images), product.weight_oz, product.length_in, product.width_in,
      product.height_in, product.status, product.featured ? 1 : 0, now, id,
    ).run();
  } catch (error) {
    if (String(error?.message ?? error).toLowerCase().includes('unique')) return json({ error: 'product_conflict' }, 409);
    throw error;
  }
  if ((result.meta?.changes ?? 0) === 0) return json({ error: 'product_not_found' }, 404);
  return json({ product: { id, ...product, updated_at: now } });
}

async function hideProduct(db, id) {
  const now = new Date().toISOString();
  const result = await db.prepare("UPDATE products SET status = 'HIDDEN', updated_at = ? WHERE id = ?")
    .bind(now, id)
    .run();
  if ((result.meta?.changes ?? 0) === 0) return json({ error: 'product_not_found' }, 404);
  return json({ id, status: 'HIDDEN', updated_at: now });
}

export async function handleAdminProducts(request, env) {
  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  const url = new URL(request.url);
  const base = '/api/admin/products';
  if (url.pathname === base && request.method === 'GET') return listProducts(db);
  if (url.pathname === base && request.method === 'POST') return createProduct(request, db);

  const match = url.pathname.match(/^\/api\/admin\/products\/([^/]+)(\/hide)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = decodeURIComponent(match[1]);
  if (!id) return json({ error: 'not_found' }, 404);
  if (match[2] === '/hide' && request.method === 'POST') return hideProduct(db, id);
  if (!match[2] && request.method === 'PUT') return updateProduct(request, db, id);
  return json({ error: 'method_not_allowed' }, 405);
}
