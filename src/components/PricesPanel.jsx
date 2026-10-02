import React, { useState } from 'react';
import { uid, num } from '../lib/model.js';
import { priceListHtml } from '../lib/prints.js';

export default function PricesPanel({ store, update }) {
  const [p, setP] = useState(null);
  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Rate list — ریٹ لسٹ</h2>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: priceListHtml(store), suggestedName: 'rate-list.pdf' })}>Print rate list</button>
      </div>
      <table className="grid" style={{ marginBottom: 10, marginTop: 10 }}>
        <thead><tr><th>Item</th><th className="r">Wash</th><th className="r">Dry clean</th><th className="r">Iron</th><th className="r">Wash+Iron</th><th></th></tr></thead>
        <tbody>
          {(store.priceList || []).map(x => (
            <tr key={x.id}>
              <td>{x.name}</td><td className="r">{num(x.wash) || '—'}</td><td className="r">{num(x.dryclean) || '—'}</td>
              <td className="r">{num(x.iron) || '—'}</td><td className="r">{num(x.washiron) || '—'}</td>
              <td>
                <button className="btn small ghost" onClick={() => setP({ ...x })}>Edit</button>
                <button className="icon" onClick={() => { if (confirm('Remove rate item?')) update(s => s.priceList = s.priceList.filter(z => z.id !== x.id), 'remove rate'); }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small ghost" onClick={() => setP({ name: '', wash: '', dryclean: '', iron: '', washiron: '' })}>+ Rate item</button>
      {p && (
        <div className="pcard" style={{ marginTop: 10 }}>
          <div className="frow">
            <input className="in" style={{ flex: 1 }} placeholder="Item (e.g. Suit)" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} />
            <label className="lbl">Wash <input className="in" style={{ width: 80 }} type="number" value={p.wash} onChange={e => setP({ ...p, wash: e.target.value })} /></label>
            <label className="lbl">Dry clean <input className="in" style={{ width: 80 }} type="number" value={p.dryclean} onChange={e => setP({ ...p, dryclean: e.target.value })} /></label>
            <label className="lbl">Iron <input className="in" style={{ width: 80 }} type="number" value={p.iron} onChange={e => setP({ ...p, iron: e.target.value })} /></label>
            <label className="lbl">Wash+Iron <input className="in" style={{ width: 80 }} type="number" value={p.washiron} onChange={e => setP({ ...p, washiron: e.target.value })} /></label>
            <button className="btn small" onClick={() => {
              if (!p.name) return;
              const row = { ...p, wash: num(p.wash), dryclean: num(p.dryclean), iron: num(p.iron), washiron: num(p.washiron) };
              update(s => { if (p.id) Object.assign(s.priceList.find(z => z.id === p.id), row); else s.priceList.push({ ...row, id: uid('p') }); }, 'save rate');
              setP(null);
            }}>Save</button>
            <button className="btn small ghost" onClick={() => setP(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
