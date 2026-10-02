import React from 'react';
import { fmt, monthSummary, owingCustomers, dueSlips, openSlips, slipPieces, today, addDays } from '../lib/model.js';
import { dailyReportHtml } from '../lib/prints.js';

export default function Dashboard({ store, go }) {
  const m = today().slice(0, 7);
  const sum = monthSummary(store, m);
  const owing = owingCustomers(store);
  const pending = openSlips(store);
  const overdue = dueSlips(store, today());
  const dueSoon = dueSlips(store, addDays(today(), 2));
  return (
    <div className="panel">
      <h2 className="ptitle">Dashboard — {m}</h2>
      <div className="cards">
        <div className="pcard"><div className="clabel">Slips pending</div><div className="cval">{pending.length}</div><div className="muted">{pending.reduce((t, o) => t + slipPieces(o), 0)} pieces</div></div>
        <div className="pcard"><div className="clabel">Collected this month</div><div className="cval">{fmt(sum.collected, store.settings.currency)}</div><div className="muted">{sum.slipCount} slips · {sum.pieces} pieces</div></div>
        <div className="pcard"><div className="clabel">Booked this month</div><div className="cval">{fmt(sum.booked, store.settings.currency)}</div></div>
        <div className="pcard" style={{ borderColor: overdue.length ? '#dc2626' : undefined }}><div className="clabel">Overdue slips</div><div className="cval">{overdue.length}</div></div>
        <div className="pcard" style={{ borderColor: owing.length ? '#f59e0b' : undefined }}><div className="clabel">Customers owing</div><div className="cval">{owing.length}</div><div className="muted">{fmt(owing.reduce((t, d) => t + d.owes, 0), store.settings.currency)}</div></div>
        <div className="pcard"><div className="clabel">Expenses this month</div><div className="cval">{fmt(sum.expenses, store.settings.currency)}</div></div>
      </div>

      <h3 className="ptitle" style={{ fontSize: 15, marginTop: 18 }}>Ready/due slips</h3>
      <table className="grid">
        <thead><tr><th>#</th><th>Customer</th><th className="r">Pieces</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          {dueSoon.slice(0, 10).map(o => {
            const c = (store.customers || []).find(x => x.id === o.customer_id) || {};
            return <tr key={o.id} style={o.due_date <= today() ? { color: '#dc2626' } : {}}><td>{o.no}</td><td>{c.name}</td><td className="r">{slipPieces(o)}</td><td>{o.due_date}</td><td>{o.status}</td></tr>;
          })}
          {!dueSoon.length && <tr><td colSpan="5" className="muted">Koi slip due nahi.</td></tr>}
        </tbody>
      </table>
      <div className="frow" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => go('slips')}>New slip</button>
        <button className="btn ghost" onClick={() => go('payments')}>Receive payment</button>
        <button className="btn ghost" onClick={() => window.api.export.pdf({ html: dailyReportHtml(store, today()), suggestedName: `daily-${today()}.pdf` })}>Print daily report</button>
      </div>
    </div>
  );
}
