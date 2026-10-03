import { sign, verify } from './crypto.js';

export interface OrderLine {
  slug: string;
  name: string;
  qty: number;
  priceCents: number;
}

export interface Order {
  id: string;
  placedAt: string;
  lines: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  cardLast4: string;
}

/** Everything the shop remembers lives in one signed cookie — no database, nothing shared
 *  between visitors, and it all disappears when the cookie does. */
export interface Session {
  user?: string;
  /** Username that passed the password step and still owes a 2FA code. */
  pending2fa?: string;
  cart: Record<string, number>;
  orders: Order[];
}

export const COOKIE = 'fm_session';
const MAX_ORDERS = 8;
const MAX_AGE_S = 60 * 60 * 24 * 7;

export const emptySession = (): Session => ({ cart: {}, orders: [] });

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export async function loadSession(request: Request, secret: string): Promise<Session> {
  const s = await verify<Session>(readCookie(request, COOKIE), secret);
  if (!s || typeof s !== 'object' || typeof s.cart !== 'object' || !Array.isArray(s.orders)) {
    return emptySession();
  }
  return s;
}

export async function sessionCookie(session: Session, secret: string, secure: boolean): Promise<string> {
  const trimmed: Session = { ...session, orders: session.orders.slice(0, MAX_ORDERS) };
  const value = await sign(trimmed, secret);
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`;
}

export const cartCount = (s: Session): number =>
  Object.values(s.cart).reduce((n, q) => n + q, 0);
