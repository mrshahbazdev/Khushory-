import React, { useState } from 'react';
import { fmt, num, monthSummary, addMonths, owingCustomers, openSlips, today } from '../lib/model.js';
import { workListHtml, dailyReportHtml } from '../lib/prints.js';

export default function ReportsPanel({ store }) {
  const cur = store.settings.currency;
  const m0 = today().slice(0, 7);
  const [day, setDay] = useState(today());
  const months = [...Array(6)].map((_, i) => addMonths(m0, -i)).reverse();
  const owing = owingCustomers(store);
  const trend = months.map(m => ({ m, ...monthSummary(store, m) }));
  const byStage = {};
  for (const o of openSlips(store)) byStage[o.status] = (byStage[o.status] || 0) + 1;
  const topItems = {};
  for (const o of store.slips || []) for (const i of o.items || []) topItems[i.name] = (topItems[i.name] || 0) + num(i.qty);
  const top = Object.entries(topItems).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="panel">
      <h2 className="ptitle">Reports</h2>
      <div className="frow" style={{ marginBottom: 14 }}>
        <input className="in" type="date" value={day} onChange={e => setDay(e.target.value)} />
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: dailyReportHtml(store, day), suggestedName: `daily-${day}.pdf` })}>Daily report</button>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: workListHtml(store), suggestedName: `worklist-${m0}.pdf` })}>Work list</button>
      </div>

      <h3 className="ptitle" style={{ fontSize: 14 }}>6-month trend</h3>
      <table className="grid">
        <thead><tr><th>Month</th><th className="r">Slips</th><th className="r">Pieces</th><th className="r">Booked</th><th className="r">Collected</th><th className="r">Expenses</th><th className="r">Net</th></tr></thead>
        <tbody>
          {trend.map(t => (
            <tr key={t.m}>
              <td>{t.m}</td><td className="r">{t.slipCount}</td><td className="r">{t.pieces}</td><td className="r">{t.booked.toLocaleString()}</td><td className="r">{t.collected.toLocaleString()}</td>
              <td className="r">{t.expenses.toLocaleString()}</td>
              <td className="r"><b>{(t.collected - t.expenses).toLocaleString()}</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Pending laundry by stage</h3>
      <table className="grid">
        <tbody>
          {Object.entries(byStage).map(([k, v]) => <tr key={k}><td>{k}</td><td className="r">{v}</td></tr>)}
          {!Object.keys(byStage).length && <tr><td className="muted">No pending laundry.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Top items</h3>
      <table className="grid">
        <thead><tr><th>Item</th><th className="r">Pieces</th></tr></thead>
        <tbody>
          {top.map(([g, c]) => <tr key={g}><td>{g}</td><td className="r">{c}</td></tr>)}
          {!top.length && <tr><td colSpan="2" className="muted">No items yet.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Customers owing</h3>
      <table className="grid">
        <thead><tr><th>Customer</th><th>Phone</th><th className="r">Owes</th></tr></thead>
        <tbody>
          {owing.map(d => (
            <tr key={d.customer.id}><td>{d.customer.name}</td><td>{d.customer.phone}</td>
              <td className="r" style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(d.owes, cur)}</td></tr>
          ))}
          {!owing.length && <tr><td colSpan="3" className="muted">Sab clear.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
