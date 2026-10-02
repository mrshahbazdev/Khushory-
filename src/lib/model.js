// Khushory document model — offline laundry/dry-clean shop register:
// customers → slips (drop-off tickets with per-item services and
// item-level status: received → washing → ready → delivered) → receipts.
// Money rows never deleted; numbers gap-free.

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 10);
export const fmt = (n, cur = 'Rs') => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const today = () => new Date().toISOString().slice(0, 10);
export const ym = iso => (iso || '').slice(0, 7);
export const addDays = (iso, k) => { const d = new Date(iso || today()); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
export const addMonths = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const ITEM_STAGES = ['received', 'washing', 'ready', 'delivered'];
export const SERVICES = ['wash', 'dry clean', 'iron', 'wash+iron'];

export const ROLES = {
  owner: 'Owner — full access',
  manager: 'Manager — slips, receipts & prices, no user management',
  counter: 'Counter — slips & item stages only',
  clerk: 'Clerk — customer records only'
};

export function emptyStore() {
  return {
    version: 1,
    customers: [],   // {id, code, name, phone, whatsapp, address, note}
    priceList: [],   // {id, name, wash, dryclean, iron, washiron}
    slips: [],       // {id, no, customer_id, created, due_date, items:[{id,name,qty,service,price,status}], status, urgent, notes}
    receipts: [],    // {id, no, customer_id, slip_id|null, date, amount, mode, ref, status, void_reason, voided_on, by}
    expenses: [],    // {id, date, head, amount, note, by}
    auditLog: [],
    settings: defaultSettings(),
    counters: { slip: 0, receipt: 0, customer: 0 },
    updatedAt: Date.now()
  };
}

export function defaultSettings() {
  return {
    companyName: '', companyAddress: '', companyPhone: '',
    currency: 'Rs',
    defaultDueDays: 3,
    receiptFooter: 'Kapray sirf claim ticket dekh kar diye jayenge — ticket sambhal kar rakhein.',
    letterheadOffset: 0,
    users: [],
    backupFolder: '', lastBackupAt: '',
    syncFolder: '', syncAuto: true, syncCode: '', hostOn: false,
    uiUrdu: false, printUrdu: true,
    firstRunDone: false, consent: null
  };
}

// ---------- lookups ----------
export const customer = (s, id) => (s.customers || []).find(c => c.id === id) || null;
export const slip = (s, id) => (s.slips || []).find(x => x.id === id) || null;
export const priceItem = (s, id) => (s.priceList || []).find(p => p.id === id) || null;
export const openSlips = s => (s.slips || []).filter(x => x.status !== 'delivered' && x.status !== 'cancelled');
export const slipTotal = o => (o.items || []).reduce((t, i) => t + num(i.price) * num(i.qty || 1), 0);
export const slipPieces = o => (o.items || []).reduce((t, i) => t + num(i.qty || 1), 0);

export function slipPaid(s, o) {
  return (s.receipts || []).filter(r => r.slip_id === o.id && r.status !== 'void').reduce((t, r) => t + num(r.amount), 0);
}
export function slipDue(s, o) { return Math.max(0, slipTotal(o) - slipPaid(s, o)); }
export function slipsFor(s, customerId) { return (s.slips || []).filter(x => x.customer_id === customerId && x.status !== 'cancelled'); }
export function customerOwes(s, customerId) { return slipsFor(s, customerId).reduce((t, o) => t + slipDue(s, o), 0); }

// slip status derived from item statuses: all delivered → delivered;
// else furthest-behind stage drives the label
export function slipStatus(o) {
  if (o.status === 'cancelled') return 'cancelled';
  const st = (o.items || []).map(i => ITEM_STAGES.indexOf(i.status));
  if (!st.length) return 'received';
  const min = Math.min(...st), max = Math.max(...st);
  if (max === 3 && min === 3) return 'delivered';
  return ITEM_STAGES[min];
}

export function setItemStage(store, slipId, itemId, stage) {
  const o = slip(store, slipId);
  if (!o || !ITEM_STAGES.includes(stage)) return null;
  const it = (o.items || []).find(i => i.id === itemId);
  if (!it) return null;
  it.status = stage;
  o.status = slipStatus(o);
  if (o.status === 'delivered') o.delivered_on = today();
  return o;
}

export function newSlip(store, { customer_id, items, due_date, urgent, notes }, advance, by) {
  store.counters.slip = (store.counters.slip || 0) + 1;
  const o = {
    id: uid('s'), no: store.counters.slip, customer_id,
    created: today(), due_date: due_date || addDays(today(), 3),
    items: (items || []).map(i => ({ id: uid('i'), name: i.name, qty: num(i.qty) || 1, service: i.service || 'wash', price: num(i.price), status: 'received' })),
    status: 'received', urgent: !!urgent, notes: notes || ''
  };
  store.slips.push(o);
  if (num(advance) > 0) receivePayment(store, { customer_id, slip_id: o.id, amount: advance, mode: 'cash' }, by);
  return o;
}

export function receivePayment(store, { customer_id, slip_id, amount, mode, ref, date }, by) {
  store.counters.receipt = (store.counters.receipt || 0) + 1;
  const r = {
    id: uid('r'), no: store.counters.receipt, customer_id, slip_id: slip_id || null,
    date: date || today(), amount: num(amount), mode: mode || 'cash', ref: ref || '',
    status: 'received', by: by || ''
  };
  store.receipts.push(r);
  return r;
}

export function voidReceipt(store, receiptId, reason) {
  const r = (store.receipts || []).find(x => x.id === receiptId);
  if (!r || r.status === 'void') return null;
  r.status = 'void'; r.void_reason = reason || ''; r.voided_on = today();
  return r;
}

// ---------- reports ----------
export function monthSummary(store, month) {
  const receipts = (store.receipts || []).filter(r => ym(r.date) === month && r.status !== 'void');
  const expenses = (store.expenses || []).filter(e => ym(e.date) === month);
  const slips = (store.slips || []).filter(o => ym(o.created) === month);
  return {
    booked: slips.reduce((t, o) => t + slipTotal(o), 0),
    pieces: slips.reduce((t, o) => t + slipPieces(o), 0),
    collected: receipts.reduce((t, r) => t + num(r.amount), 0),
    expenses: expenses.reduce((t, e) => t + num(e.amount), 0),
    slipCount: slips.length
  };
}

export function dueSlips(store, uptoDate) {
  return openSlips(store).filter(o => o.due_date <= uptoDate).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function owingCustomers(store) {
  return (store.customers || []).map(c => ({ customer: c, owes: customerOwes(store, c.id) }))
    .filter(x => x.owes > 0).sort((a, b) => b.owes - a.owes);
}

export function waLink(phone, text) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  const intl = d.startsWith('92') ? d : d.startsWith('0') ? '92' + d.slice(1) : d;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

// ---------- sample data ----------
export function sampleStore() {
  const s = emptyStore();
  s.settings.companyName = 'Khushbu Dry Cleaners';
  s.settings.companyAddress = 'Main Bazar, Gujranwala';
  s.settings.companyPhone = '055-5550200';
  s.priceList = [
    { id: 'p1', name: 'Suit (2pc)', wash: 0, dryclean: 450, iron: 150, washiron: 0 },
    { id: 'p2', name: 'Shalwar Kameez', wash: 120, dryclean: 250, iron: 80, washiron: 180 },
    { id: 'p3', name: 'Shirt', wash: 60, dryclean: 0, iron: 40, washiron: 90 },
    { id: 'p4', name: 'Pant', wash: 60, dryclean: 0, iron: 40, washiron: 90 },
    { id: 'p5', name: 'Blanket', wash: 300, dryclean: 0, iron: 0, washiron: 300 },
    { id: 'p6', name: 'Curtain', wash: 200, dryclean: 0, iron: 100, washiron: 280 },
    { id: 'p7', name: 'Chadar/Bedsheet', wash: 100, dryclean: 0, iron: 60, washiron: 140 }
  ];
  const cust = (id, code, name, phone) => ({ id, code, name, phone, whatsapp: phone, address: '', note: '' });
  s.customers = [
    cust('c1', 'K-001', 'Iqbal Saab', '0300-1112233'),
    cust('c2', 'K-002', 'Mrs. Rauf', '0321-5556677'),
    cust('c3', 'K-003', 'Dr. Adeel', '0333-8889900'),
    cust('c4', 'K-004', 'Hotel Pearl', '0345-7778889')
  ];
  s.counters.customer = 4;
  let n = 0;
  const mkSlip = (custId, items, due, created, adv, urgent) => {
    const o = {
      id: uid('s'), no: ++n, customer_id: custId, created, due_date: due,
      items: items.map(i => ({ id: uid('i'), ...i })), status: 'received', urgent: !!urgent, notes: ''
    };
    s.slips.push(o);
    o.status = slipStatus(o);
    if (adv > 0) { s.counters.receipt++; s.receipts.push({ id: uid('r'), no: s.counters.receipt, customer_id: custId, slip_id: o.id, date: created, amount: adv, mode: 'cash', ref: '', status: 'received', by: 'owner' }); }
    return o;
  };
  mkSlip('c1', [
    { name: 'Suit (2pc)', qty: 1, service: 'dry clean', price: 450, status: 'washing' },
    { name: 'Shirt', qty: 4, service: 'wash+iron', price: 90, status: 'received' }
  ], addDays(today(), 2), addDays(today(), -1), 400, false);
  mkSlip('c2', [
    { name: 'Blanket', qty: 2, service: 'wash', price: 300, status: 'ready' }
  ], today(), addDays(today(), -3), 0, true);
  mkSlip('c3', [
    { name: 'Shalwar Kameez', qty: 3, service: 'wash+iron', price: 180, status: 'received' }
  ], addDays(today(), 3), today(), 300, false);
  mkSlip('c4', [
    { name: 'Chadar/Bedsheet', qty: 20, service: 'wash+iron', price: 140, status: 'delivered' },
    { name: 'Curtain', qty: 6, service: 'wash+iron', price: 280, status: 'delivered' }
  ], addDays(today(), -4), addDays(today(), -8), 4480, false);
  s.counters.slip = n;
  s.expenses = [{ id: uid('e'), date: addDays(today(), -5), head: 'Detergent & solvent', amount: 6500, note: '', by: 'owner' }];
  s.settings.firstRunDone = false;
  return s;
}
