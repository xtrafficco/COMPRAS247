import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(new URL('./cfg.json', import.meta.url)));
const creds = JSON.parse(fs.readFileSync(new URL('./creds.json', import.meta.url)));
const products = JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf8'));

const r = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@petville', password: creds.admin })
});
if (!r.ok) { console.error('login failed', r.status, await r.text()); process.exit(1); }
const token = (await r.json()).access_token;
const H = { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function post(path, rows, prefer = 'return=minimal') {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method: 'POST', headers: { ...H, Prefer: prefer }, body: JSON.stringify(rows)
  });
  if (!res.ok) { console.error('POST', path, res.status, (await res.text()).slice(0, 500)); process.exit(1); }
  return prefer.includes('representation') ? res.json() : null;
}

const IMPORTED_AT = '2026-11-11T00:00:00Z';

// ---- produtos ----
const prodRows = products.map(p => ({
  legacy_id: p.id, code: p.code, name: p.name,
  cost_price: p.price, sale_price: p.salePrice, active: p.active,
  archived_at: p.active ? null : IMPORTED_AT
}));
for (let i = 0; i < prodRows.length; i += 500) {
  await post('purchase_products', prodRows.slice(i, i + 500));
  process.stdout.write(`produtos ${Math.min(i + 500, prodRows.length)}/${prodRows.length}\r`);
}
console.log(`\nprodutos inseridos: ${prodRows.length}`);

// ---- mapa legacy_id -> id real ----
const map = new Map();
for (let after = 0; ;) {
  const res = await fetch(`${cfg.url}/rest/v1/purchase_products?select=id,legacy_id&id=gt.${after}&order=id.asc&limit=1000`, { headers: H });
  const rows = await res.json();
  if (!rows.length) break;
  for (const row of rows) map.set(row.legacy_id, row.id);
  after = rows[rows.length - 1].id;
}
console.log('mapa de produtos:', map.size);

// ---- vendas mensais ----
const saleRows = [];
for (const p of products) {
  p.sales.forEach((qty, idx) => {
    if (qty > 0) saleRows.push({ product_id: map.get(p.id), sale_year: 2026, sale_month: idx + 1, quantity: qty, imported_at: IMPORTED_AT });
  });
}
for (let i = 0; i < saleRows.length; i += 2000) {
  await post('purchase_sales', saleRows.slice(i, i + 2000));
  process.stdout.write(`vendas ${Math.min(i + 2000, saleRows.length)}/${saleRows.length}\r`);
}
console.log(`\nvendas mensais inseridas: ${saleRows.length}`);
