// Print HTML: claim ticket (A5, item list), receipt (A5),
// price list card (A5), work list (A4), daily report (A4).
import { fmt, num, customer, slipTotal, slipPieces, slipPaid, slipDue, openSlips, slipsFor, today } from './model.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baseCss = extra => `
  body{font:10pt 'Segoe UI',sans-serif;color:#111}
  .co-name{font-size:13pt;font-weight:700;text-align:center}
  .co-sub{text-align:center;font-size:8.5pt;color:#444;margin-bottom:5mm}
  table{width:100%;border-collapse:collapse} td{padding:1.8mm;border-bottom:1px solid #e2e8f0}
  .r{text-align:right}.big{font-size:12pt;font-weight:700}
  .sign{display:flex;justify-content:space-between;margin:14mm 2mm 0;font-size:8pt;color:#444}
  .sign span{border-top:1px solid #555;padding-top:1mm;min-width:26mm;text-align:center}
  .foot{margin-top:8mm;text-align:center;font-size:8pt;color:#666}
  ${extra || ''}`;
const head = (store, label) => {
  const s = store.settings;
  return `<div class="co-name">${esc(s.companyName || 'Laundry')}</div>
    <div class="co-sub" style="padding-top:${num(s.letterheadOffset)}mm">${esc(s.companyAddress || '')} ${s.companyPhone ? ' · ' + esc(s.companyPhone) : ''}</div>
    <div style="text-align:center;font-weight:600;margin-bottom:4mm">${esc(label)}</div>`;
};
const foot = store => `<div class="foot">${esc(store.settings.receiptFooter || '')}</div>`;
const doc = (title, css, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${baseCss(css)}</style></head><body>${body}</body></html>`;

export function claimTicketHtml(store, o) {
  const c = customer(store, o.customer_id) || {};
  const paid = slipPaid(store, o), due = slipDue(store, o);
  return doc(`Ticket #${o.no}`, '.nb td{border:none} .it td{border:1px solid #cbd5e1;font-size:9pt;padding:1.5mm}', `${head(store, 'Claim Ticket' + (o.urgent ? ' — URGENT' : ''))}
    <table class="nb">
      <tr><td><b>Ticket #${o.no}</b></td><td class="r">In: ${esc(o.created)} · <b>Ready: ${esc(o.due_date)}</b></td></tr>
      <tr><td colspan="2">Customer: <b>${esc(c.name)}</b> ${c.code ? '(' + esc(c.code) + ')' : ''} · ${esc(c.phone || '')}</td></tr>
    </table>
    <table class="it" style="margin-top:3mm"><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:left">Service</th><th class="r">Rate</th><th class="r">Amount</th></tr>
      ${(o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td style="text-align:center">${num(i.qty)}</td><td>${esc(i.service)}</td><td class="r">${num(i.price).toLocaleString()}</td><td class="r">${(num(i.price) * num(i.qty)).toLocaleString()}</td></tr>`).join('')}
      <tr><td colspan="4"><b>Total (${slipPieces(o)} pieces)</b></td><td class="r big">${fmt(slipTotal(o), store.settings.currency)}</td></tr>
      <tr><td colspan="4">Paid</td><td class="r">${num(paid).toLocaleString()}</td></tr>
      <tr><td colspan="4"><b>Balance</b></td><td class="r"><b>${num(due).toLocaleString()}</b></td></tr>
    </table>
    ${o.notes ? `<p style="font-size:8.5pt">Notes: ${esc(o.notes)}</p>` : ''}
    <div class="sign"><span>Customer signature</span><span>Receiver</span></div>
    ${foot(store)}`);
}

export function receiptHtml(store, r) {
  const c = customer(store, r.customer_id) || {};
  const o = r.slip_id ? (store.slips || []).find(x => x.id === r.slip_id) : null;
  return doc(`Receipt #${r.no}`, '.nb td{border:none}', `${head(store, 'Payment Receipt')}
    <table>
      <tr><td><b>Receipt #${r.no}</b>${r.status === 'void' ? ' — VOID' : ''}</td><td class="r">Date: ${esc(r.date)}</td></tr>
      <tr><td colspan="2">Received from: <b>${esc(c.name)}</b> ${c.code ? '(' + esc(c.code) + ')' : ''}</td></tr>
      <tr><td>${o ? 'Against ticket #' + o.no : 'On account'}</td><td class="r">Mode: ${esc(r.mode)}${r.ref ? ' · ' + esc(r.ref) : ''}</td></tr>
      <tr><td><b>Amount</b></td><td class="r big">${fmt(r.amount, store.settings.currency)}</td></tr>
    </table>
    <div class="sign"><span>Received by: ${esc(r.by || '')}</span><span>Signature</span></div>
    ${foot(store)}`);
}

export function priceListHtml(store) {
  return doc('Price list', '', `${head(store, 'Rate List')}
    <table><tr><th style="text-align:left">Item</th><th class="r">Wash</th><th class="r">Dry clean</th><th class="r">Iron</th><th class="r">Wash+Iron</th></tr>
    ${(store.priceList || []).map(p => `<tr><td>${esc(p.name)}</td><td class="r">${num(p.wash) || '—'}</td><td class="r">${num(p.dryclean) || '—'}</td><td class="r">${num(p.iron) || '—'}</td><td class="r">${num(p.washiron) || '—'}</td></tr>`).join('')}
    </table>${foot(store)}`);
}

export function workListHtml(store) {
  const list = openSlips(store).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return doc('Work list', '', `${head(store, 'Work List — pending laundry by due date')}
    <table><tr><th>#</th><th style="text-align:left">Customer</th><th style="text-align:center">Pieces</th><th style="text-align:left">Due</th><th style="text-align:left">Status</th><th class="r">Balance</th></tr>
    ${list.map(o => { const c = customer(store, o.customer_id) || {}; return `<tr${o.urgent ? ' style="background:#fef2f2"' : ''}><td>${o.no}</td><td>${esc(c.name)}</td><td style="text-align:center">${slipPieces(o)}</td><td>${o.due_date}</td><td>${o.status}</td><td class="r">${num(slipDue(store, o)).toLocaleString()}</td></tr>`; }).join('')}
    ${!list.length ? '<tr><td colspan="6">No pending laundry.</td></tr>' : ''}</table>
    ${foot(store)}`);
}

export function dailyReportHtml(store, date) {
  const slips = (store.slips || []).filter(o => o.created === date);
  const receipts = (store.receipts || []).filter(r => r.date === date && r.status !== 'void');
  const expenses = (store.expenses || []).filter(e => e.date === date);
  return doc(`Daily report ${date}`, '', `${head(store, 'Daily Report — ' + date)}
    <table><tr><th style="text-align:left">Slips in</th><th class="r">Pieces</th><th class="r">Booked</th><th class="r">Collected</th><th class="r">Expenses</th><th class="r">Net</th></tr>
    <tr><td>${slips.length}</td><td class="r">${slips.reduce((t, o) => t + slipPieces(o), 0)}</td><td class="r">${slips.reduce((t, o) => t + slipTotal(o), 0).toLocaleString()}</td>
    <td class="r">${receipts.reduce((t, r) => t + num(r.amount), 0).toLocaleString()}</td>
    <td class="r">${expenses.reduce((t, e) => t + num(e.amount), 0).toLocaleString()}</td>
    <td class="r"><b>${(receipts.reduce((t, r) => t + num(r.amount), 0) - expenses.reduce((t, e) => t + num(e.amount), 0)).toLocaleString()}</b></td></tr></table>
    <table style="margin-top:4mm"><tr><th>#</th><th style="text-align:left">Customer</th><th style="text-align:center">Pieces</th><th class="r">Total</th><th style="text-align:left">Due date</th></tr>
    ${slips.map(o => { const c = customer(store, o.customer_id) || {}; return `<tr><td>${o.no}</td><td>${esc(c.name)}</td><td style="text-align:center">${slipPieces(o)}</td><td class="r">${slipTotal(o).toLocaleString()}</td><td>${o.due_date}</td></tr>`; }).join('') || '<tr><td colspan="5">No slips.</td></tr>'}</table>
    ${foot(store)}`);
}

export function statementHtml(store, c) {
  const slips = slipsFor(store, c.id);
  const receipts = (store.receipts || []).filter(r => r.customer_id === c.id);
  return doc(`Statement — ${c.name}`, '', `${head(store, 'Customer Khata')}
    <table><tr><td><b>${esc(c.name)}</b> ${c.code ? '(' + esc(c.code) + ')' : ''}</td><td class="r">${esc(c.phone || '')}</td></tr></table>
    <table style="margin-top:4mm"><tr><th>#</th><th style="text-align:center">Pieces</th><th style="text-align:left">Date</th><th style="text-align:left">Status</th><th class="r">Total</th><th class="r">Due</th></tr>
    ${slips.map(o => `<tr><td>${o.no}</td><td style="text-align:center">${slipPieces(o)}</td><td>${o.created}</td><td>${o.status}</td><td class="r">${slipTotal(o).toLocaleString()}</td><td class="r">${slipDue(store, o).toLocaleString()}</td></tr>`).join('')}</table>
    <table style="margin-top:4mm"><tr><th style="text-align:left">Date</th><th style="text-align:left">Receipt</th><th class="r">Amount</th><th style="text-align:left">Mode</th></tr>
    ${receipts.map(r => `<tr><td>${r.date}</td><td>#${r.no}${r.status === 'void' ? ' (void)' : ''}</td><td class="r">${r.status === 'void' ? '—' : num(r.amount).toLocaleString()}</td><td>${esc(r.mode)}</td></tr>`).join('')}</table>
    ${foot(store)}`);
}
