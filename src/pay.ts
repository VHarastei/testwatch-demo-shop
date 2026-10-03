import { sign, verify } from './crypto.js';

/** A Stripe-like hosted card field: the card form lives in an iframe, the shop only ever sees
 *  a short-lived signed token. Only published test numbers behave like real cards. */
export const TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
} as const;

export interface PayToken {
  last4: string;
  amountCents: number;
  exp: number;
}

export type TokenizeResult = { ok: true; token: string; last4: string } | { ok: false; error: string };

export function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

export function expiryValid(mmYy: string, now = new Date()): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(mmYy.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  // Valid through the last day of the expiry month.
  return new Date(Date.UTC(year, month, 1)) > now;
}

export async function tokenize(
  input: { number: string; expiry: string; cvc: string; amountCents: number },
  secret: string,
  now = Date.now(),
): Promise<TokenizeResult> {
  const number = input.number.replace(/[\s-]/g, '');
  if (!/^\d{12,19}$/.test(number) || !luhn(number)) {
    return { ok: false, error: 'Your card number is invalid.' };
  }
  if (!expiryValid(input.expiry, new Date(now))) {
    return { ok: false, error: "Your card's expiration date is invalid." };
  }
  if (!/^\d{3,4}$/.test(input.cvc.trim())) {
    return { ok: false, error: "Your card's security code is invalid." };
  }
  if (number === TEST_CARDS.declined) return { ok: false, error: 'Your card was declined.' };
  if (number !== TEST_CARDS.success) {
    return { ok: false, error: 'This demo shop only accepts the test card 4242 4242 4242 4242.' };
  }
  const last4 = number.slice(-4);
  const token = await sign(
    { last4, amountCents: input.amountCents, exp: now + 10 * 60_000 } satisfies PayToken,
    `pay:${secret}`,
  );
  return { ok: true, token, last4 };
}

export async function readPayToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<PayToken | null> {
  const t = await verify<PayToken>(token, `pay:${secret}`);
  return t && t.exp > now ? t : null;
}
