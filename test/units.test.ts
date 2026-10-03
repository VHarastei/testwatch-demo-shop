import { describe, expect, test } from 'vitest';
import { checkPassword } from '../src/accounts.js';
import { cartView, setQty } from '../src/cart.js';
import { search } from '../src/catalog.js';
import { sign, verify } from '../src/crypto.js';
import { html, raw } from '../src/html.js';
import { ordersCsv } from '../src/orders.js';
import { expiryValid, luhn, readPayToken, tokenize } from '../src/pay.js';
import { emptySession } from '../src/session.js';
import { hotp, totp, verifyTotp } from '../src/totp.js';

describe('totp', () => {
  // RFC 4226 appendix D test vectors (secret "12345678901234567890").
  test('hotp vectors', async () => {
    const key = new TextEncoder().encode('12345678901234567890');
    const expected = ['755224', '287082', '359152', '969429', '338314'];
    for (const [i, code] of expected.entries()) expect(await hotp(key, i)).toBe(code);
  });
  test('verify accepts ±1 step, rejects others', async () => {
    const secret = 'GZ4FORKTNBVFGQTFJJGEIRDOKY';
    const now = 1_790_000_000_000;
    expect(await verifyTotp(secret, await totp(secret, now), now)).toBe(true);
    expect(await verifyTotp(secret, await totp(secret, now - 30_000), now)).toBe(true);
    expect(await verifyTotp(secret, await totp(secret, now - 90_000), now)).toBe(false);
    expect(await verifyTotp(secret, 'abcdef', now)).toBe(false);
  });
});

describe('signed values', () => {
  test('round-trip and tamper', async () => {
    const t = await sign({ a: 1 }, 's');
    expect(await verify(t, 's')).toEqual({ a: 1 });
    expect(await verify(t, 'other')).toBeNull();
    const [p, sig] = t.split('.');
    expect(await verify(`${p}x.${sig}`, 's')).toBeNull();
    expect(await verify('garbage', 's')).toBeNull();
  });
});

test('html escapes values but not nested html', () => {
  expect(html`<p>${'<b>'}</p>`.toString()).toBe('<p>&lt;b&gt;</p>');
  expect(html`<p>${raw('<b>')}${html`<i>${'"'}</i>`}</p>`.toString()).toBe('<p><b><i>&quot;</i></p>');
});

test('search matches every word', () => {
  expect(search('notebook').length).toBeGreaterThanOrEqual(3);
  expect(search('waterproof notebook').map((p) => p.slug)).toEqual(['waterproof-notebook']);
  expect(search('kayak')).toEqual([]);
  expect(search('   ')).toEqual([]);
});

test('passwords', () => {
  expect(checkPassword('shopper', 'fieldmark-demo')?.username).toBe('shopper');
  expect(checkPassword(' SHOPPER ', 'fieldmark-demo')?.username).toBe('shopper');
  expect(checkPassword('shopper', 'nope')).toBeNull();
  expect(checkPassword('nobody', 'fieldmark-demo')).toBeNull();
});

describe('cart', () => {
  test('totals include shipping; the bug variant drops it', () => {
    const s = emptySession();
    setQty(s, 'graphite-pencils', 2);
    setQty(s, 'no-such-thing', 3);
    expect(cartView(s, 'normal')).toMatchObject({ subtotalCents: 1800, shippingCents: 500, totalCents: 2300 });
    expect(cartView(s, 'bug').totalCents).toBe(1800);
    expect(cartView(s, 'drift,bug').totalCents).toBe(1800);
    expect(cartView(s, 'drift').totalCents).toBe(2300);
    setQty(s, 'graphite-pencils', 999);
    expect(s.cart['graphite-pencils']).toBe(20);
    setQty(s, 'graphite-pencils', 0);
    expect(cartView(s, 'normal')).toMatchObject({ lines: [], totalCents: 0 });
  });
});

describe('card payments', () => {
  test('luhn + expiry', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    const now = new Date('2026-10-03T00:00:00Z');
    expect(expiryValid('10/26', now)).toBe(true);
    expect(expiryValid('09/26', now)).toBe(false);
    expect(expiryValid('13/30', now)).toBe(false);
  });
  test('success card tokenizes; declined card and other cards fail', async () => {
    const base = { expiry: '12/34', cvc: '123', amountCents: 2300 };
    const ok = await tokenize({ ...base, number: '4242 4242 4242 4242' }, 's');
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(await readPayToken(ok.token, 's')).toMatchObject({ last4: '4242', amountCents: 2300 });
    if (ok.ok) expect(await readPayToken(ok.token, 's', Date.now() + 11 * 60_000)).toBeNull();
    expect(await tokenize({ ...base, number: '4000000000000002' }, 's')).toEqual({
      ok: false,
      error: 'Your card was declined.',
    });
    expect((await tokenize({ ...base, number: '5555555555554444' }, 's')).ok).toBe(false);
    expect((await tokenize({ ...base, number: '4242424242424242', cvc: '1' }, 's')).ok).toBe(false);
  });
});

test('orders CSV: one row per line, quoted where needed', () => {
  const csv = ordersCsv([
    {
      id: 'FM-ABC123',
      placedAt: '2026-10-03T10:00:00.000Z',
      lines: [{ slug: 'x', name: 'Pencils, 12', qty: 2, priceCents: 900 }],
      subtotalCents: 1800,
      shippingCents: 500,
      totalCents: 2300,
      cardLast4: '4242',
    },
  ]);
  expect(csv).toBe(
    'order_id,placed_at,item,quantity,unit_price,line_total,order_total\nFM-ABC123,2026-10-03T10:00:00.000Z,"Pencils, 12",2,9.00,18.00,23.00\n',
  );
});
