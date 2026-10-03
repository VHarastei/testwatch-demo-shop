import type { Order } from './session.js';

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** One row per order line — what a "download your orders" export usually looks like. */
export function ordersCsv(orders: Order[]): string {
  const rows: (string | number)[][] = [
    ['order_id', 'placed_at', 'item', 'quantity', 'unit_price', 'line_total', 'order_total'],
  ];
  for (const o of orders) {
    for (const l of o.lines) {
      rows.push([
        o.id,
        o.placedAt,
        l.name,
        l.qty,
        (l.priceCents / 100).toFixed(2),
        ((l.priceCents * l.qty) / 100).toFixed(2),
        (o.totalCents / 100).toFixed(2),
      ]);
    }
  }
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
