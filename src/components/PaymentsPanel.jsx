import React, { useState } from 'react';
import { fmt, num, customer, slipDue, slipsFor, receivePayment, voidReceipt, today, ym } from '../lib/model.js';
import { receiptHtml } from '../lib/prints.js';

export default function PaymentsPanel({ store, update, user }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [pay, setPay] = useState(null);
  const cur = store.settings.currency;
  const canMoney = !user || ['owner', 'manager'].includes(user.role);

  const receipts = (store.receipts || []).filter(r => ym(r.date) === month).sort((a, b) => b.no - a.no);

  const doPay = () => {
    if (!num(pay.amount) || !pay.customer_id) return;
    update(s => receivePayment(s, { customer_id: pay.customer_id, slip_id: pay.slip_id || null, amount: num(pay.amount), mode: pay.mode, ref: pay.ref, date: pay.date }, user?.name || 'app'), `receipt for ${customer(store, pay.customer_id)?.name}`);
    setPay(null);
  };

  const openSlips = pay?.customer_id ? slipsFor(store, pay.customer_id).filter(o => slipDue(store, o) > 0) : [];

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Receipts — {month}</h2>
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        {canMoney && <button className="btn" onClick={() => setPay({ customer_id: '', slip_id: '', amount: '', date: today(), mode: 'cash', ref: '' })}>+ Receive payment</button>}
      </div>

      {pay && (
        <div className="pcard" style={{ marginTop: 10, marginBottom: 10 }}>
          <div className="frow">
            <select className="in" style={{ flex: 1 }} value={pay.customer_id} onChange={e => setPay({ ...pay, customer_id: e.target.value, slip_id: '' })}>
              <option value="">— customer —</option>
              {(store.customers || []).map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
            <select className="in" value={pay.slip_id} onChange={e => { const o = openSlips.find(x => x.id === e.target.value); setPay({ ...pay, slip_id: e.target.value, amount: o ? slipDue(store, o) : pay.amount }); }}>
              <option value="">on account (no ticket)</option>
              {openSlips.map(o => <option key={o.id} value={o.id}>#{o.no} — due {num(slipDue(store, o)).toLocaleString()}</option>)}
            </select>
            <label className="lbl">Amount <input className="in" style={{ width: 120 }} type="number" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="lbl">Date <input className="in" type="date" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} /></label>
            <select className="in" value={pay.mode} onChange={e => setPay({ ...pay, mode: e.target.value })}>
              {['cash', 'bank', 'online', 'cheque'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input className="in" placeholder="Ref" value={pay.ref} onChange={e => setPay({ ...pay, ref: e.target.value })} />
            <button className="btn small" onClick={doPay}>Receive</button>
            <button className="btn small ghost" onClick={() => setPay(null)}>Cancel</button>
          </div>
        </div>
      )}

      <table className="grid">
        <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Ticket</th><th>Mode</th><th className="r">Amount</th><th>By</th><th></th></tr></thead>
        <tbody>
          {receipts.map(r => {
            const c = customer(store, r.customer_id) || {};
            const o = r.slip_id ? (store.slips || []).find(x => x.id === r.slip_id) : null;
            return (
              <tr key={r.id} className={r.status === 'void' ? 'muted' : ''}>
                <td>{r.no}</td><td>{r.date}</td><td>{c.name}</td><td>{o ? '#' + o.no : '—'}</td>
                <td>{r.mode}{r.ref ? ' · ' + r.ref : ''}</td>
                <td className="r">{r.status === 'void' ? 'VOID' : fmt(r.amount, cur)}</td><td>{r.by}</td>
                <td>
                  <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: receiptHtml(store, r), suggestedName: `receipt-${r.no}.pdf` })}>Print</button>
                  {r.status !== 'void' && canMoney && <button className="icon" title="Void receipt" onClick={() => { const x = prompt('Void reason (receipt row kept):'); if (x !== null) update(s => voidReceipt(s, r.id, x), `void receipt #${r.no}`); }}>✕</button>}
                </td>
              </tr>
            );
          })}
          {!receipts.length && <tr><td colSpan="8" className="muted">No receipts this month.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
