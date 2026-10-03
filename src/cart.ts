import { bySlug, type Product, SHIPPING_CENTS } from './catalog.js';
import type { OrderLine, Session } from './session.js';

export const MAX_QTY = 20;

export interface CartView {
  lines: (OrderLine & { product: Product })[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

/** `bug` variant: the total silently leaves shipping out — a real bug a test should catch,
 *  not UI drift a locator fix should paper over. */
export function cartView(session: Session, variant: string): CartView {
  const lines = Object.entries(session.cart).flatMap(([slug, qty]) => {
    const product = bySlug(slug);
    if (!product || qty <= 0) return [];
    return [{ slug, name: product.name, qty, priceCents: product.priceCents, product }];
  });
  const subtotalCents = lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
  const shippingCents = lines.length > 0 ? SHIPPING_CENTS : 0;
  const totalCents = hasVariant(variant, 'bug') ? subtotalCents : subtotalCents + shippingCents;
  return { lines, subtotalCents, shippingCents, totalCents };
}

/** `VARIANT` may combine switches, e.g. `drift,bug`. */
export const hasVariant = (variant: string, name: 'drift' | 'bug'): boolean =>
  variant.split(',').map((v) => v.trim()).includes(name);

export function setQty(session: Session, slug: string, qty: number): void {
  if (!bySlug(slug)) return;
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
  if (q === 0) delete session.cart[slug];
  else session.cart[slug] = q;
}
