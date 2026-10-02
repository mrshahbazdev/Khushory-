import React, { useState } from 'react';
import { fmt, num, customer, slipTotal, slipPieces, slipDue, newSlip, setItemStage, ITEM_STAGES, SERVICES, today, addDays } from '../lib/model.js';
import { claimTicketHtml, workListHtml } from '../lib/prints.js';

export default function SlipsPanel({ store, update, user }) {
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('open');
  const [open, setOpen] = useState(null);
  const cur = store.settings.currency;
  const canStage = !user || ['owner', 'manager', 'counter'].includes(user.role);

  const list = (store.slips || []).filter(o => tab === 'open' ? (o.status !== 'delivered' && o.status !== 'cancelled') : o.status === tab)
    .sort((a, b) => b.no - a.no);

  const addLine = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, service: 'wash', price: '' }] });
  const setLine = (i, k, v) => { const items = form.items.slice(); items[i] = { ...items[i], [k]: v }; setForm({ ...form, items }); };

  const pickPrice = (i, priceId) => {
    const p = (store.priceList || []).find(x => x.id === priceId);
    if (!p) return;
    const items = form.items.slice();
    const svc = items[i].service;
    const rate = svc === 'dry clean' ? p.dryclean : svc === 'iron' ? p.iron : svc === 'wash+iron' ? p.washiron : p.wash;
    items[i] = { ...items[i], name: p.name, price: rate || '' };
    setForm({ ...form, items });
  };

  const book = () => {
    const items = form.items.filter(i => i.name && num(i.price) > 0);
    if (!form.customer_id || !items.length) return;
    update(s => newSlip(s, { ...form, items }, num(form.advance), user?.name || 'app'), `slip for ${customer(store, form.customer_id)?.name}`);
    setForm(null);
  };

  const detail = open ? (store.slips || []).find(o => o.id === open) : null;

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Slips — drop-off tickets</h2>
        <select className="in" value={tab} onChange={e => setTab(e.target.value)}>
          <option value="open">Open</option>
          {ITEM_STAGES.map(x => <option key={x} value={x}>{x}</option>)}
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn" onClick={() => setForm({ customer_id: store.customers[0]?.id || '', due_date: addDays(today(), num(store.settings.defaultDueDays) || 3), advance: '', urgent: false, notes: '', items: [{ name: '', qty: 1, service: 'wash', price: '' }] })}>+ New slip</button>
        <button className="btn ghost" onClick={() => window.api.export.pdf({ html: workListHtml(store), suggestedName: `worklist-${today()}.pdf` })}>Print work list</button>
      </div>

      {form && (
        <div className="pcard" style={{ marginTop: 10, marginBottom: 10 }}>
          <div className="frow">
            <select className="in" style={{ flex: 1 }} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
              {(store.customers || []).map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
            <label className="lbl">Ready date <input className="in" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label>
            <label className="lbl">Advance <input className="in" style={{ width: 110 }} type="number" value={form.advance} onChange={e => setForm({ ...form, advance: e.target.value })} /></label>
            <label className="chk"><input type="checkbox" checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })} /> Urgent</label>
          </div>
          <table className="grid" style={{ marginTop: 8 }}>
            <thead><tr><th>Item (rate list / free text)</th><th>Qty</th><th>Service</th><th className="r">Rate</th><th></th></tr></thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <select className="in" style={{ width: '45%' }} value="" onChange={e => pickPrice(i, e.target.value)}>
                      <option value="">— pick —</option>
                      {(store.priceList || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="in" style={{ width: '50%' }} placeholder="or type" value={it.name} onChange={e => setLine(i, 'name', e.target.value)} />
                  </td>
                  <td><input className="in" style={{ width: 60 }} type="number" min="1" value={it.qty} onChange={e => setLine(i, 'qty', e.target.value)} /></td>
                  <td><select className="in" value={it.service} onChange={e => { setLine(i, 'service', e.target.value); }}>{SERVICES.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td><input className="in" style={{ width: 90 }} type="number" value={it.price} onChange={e => setLine(i, 'price', e.target.value)} /></td>
                  <td><button className="icon" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small ghost" onClick={addLine}>+ line</button>
            <span className="muted">Total: {fmt(form.items.reduce((t, i) => t + num(i.price) * num(i.qty || 1), 0), cur)}</span>
            <input className="in" style={{ flex: 1 }} placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <button className="btn small" onClick={book}>Save slip + ticket</button>
            <button className="btn small ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <table className="grid">
        <thead><tr><th>#</th><th>Customer</th><th className="r">Pieces</th><th>In</th><th>Ready</th><th className="r">Total</th><th className="r">Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map(o => {
            const c = customer(store, o.customer_id) || {};
            const due = slipDue(store, o);
            const late = o.status !== 'delivered' && o.due_date < today();
            return (
              <tr key={o.id} style={o.urgent ? { background: '#fef2f2' } : {}}>
                <td>{o.no}{o.urgent ? ' ⚡' : ''}</td>
                <td><a href="#" onClick={e => { e.preventDefault(); setOpen(o.id); }}>{c.name}</a></td>
                <td className="r">{slipPieces(o)}</td><td>{o.created}</td>
                <td style={late ? { color: '#dc2626', fontWeight: 700 } : {}}>{o.due_date}</td>
                <td className="r">{fmt(slipTotal(o), cur)}</td>
                <td className="r" style={{ color: due ? '#dc2626' : '#16a34a' }}>{due ? fmt(due, cur) : '✓'}</td>
                <td><span className={'tag ' + (o.status === 'delivered' ? 'ok' : 'warn')}>{o.status}</span></td>
                <td><button className="btn small ghost" onClick={() => window.api.export.pdf({ html: claimTicketHtml(store, o), suggestedName: `ticket-${o.no}.pdf` })}>Ticket</button></td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan="9" className="muted">No slips.</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="pcard" style={{ marginTop: 14 }}>
          <div className="frow" style={{ justifyContent: 'space-between' }}>
            <b>Slip #{detail.no} — {customer(store, detail.customer_id)?.name}</b>
            <button className="btn small ghost" onClick={() => setOpen(null)}>Close</button>
          </div>
          <table className="grid" style={{ marginTop: 8 }}>
            <thead><tr><th>Item</th><th className="r">Qty</th><th>Service</th><th className="r">Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(detail.items || []).map(it => (
                <tr key={it.id}>
                  <td>{it.name}</td><td className="r">{it.qty}</td><td>{it.service}</td><td className="r">{num(it.price).toLocaleString()}</td>
                  <td><span className={'tag ' + (it.status === 'delivered' ? 'ok' : 'warn')}>{it.status}</span></td>
                  <td>{canStage && it.status !== 'delivered' && (
                    <select className="in" style={{ width: 110, padding: '2px 4px' }} value="" onChange={e => e.target.value && update(s => setItemStage(s, detail.id, it.id, e.target.value), `#${detail.no} ${it.name} → ${e.target.value}`)}>
                      <option value="">stage…</option>
                      {ITEM_STAGES.filter(x => x !== it.status).map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
