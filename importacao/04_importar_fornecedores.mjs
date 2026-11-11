import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(new URL('./cfg.json', import.meta.url)));
const creds = JSON.parse(fs.readFileSync(new URL('./creds.json', import.meta.url)));
const suppliers = JSON.parse(fs.readFileSync(new URL('./suppliers.json', import.meta.url), 'utf8'));

const r = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@petville', password: creds.admin })
});
if (!r.ok) { console.error('login falhou', r.status, await r.text()); process.exit(1); }
const token = (await r.json()).access_token;
const H = { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const rows = suppliers.map(s => ({
  legacy_id: s.id, name: s.name,
  contact: s.contact || null, phone: s.phone || null,
  default_terms: s.terms || null, notes: s.notes || null, active: true
}));

const res = await fetch(`${cfg.url}/rest/v1/purchase_suppliers`, {
  method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows)
});
if (!res.ok) { console.error('POST falhou', res.status, (await res.text()).slice(0, 600)); process.exit(1); }
console.log('fornecedores inseridos:', rows.length);
