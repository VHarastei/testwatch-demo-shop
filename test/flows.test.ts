import { describe, expect, test } from 'vitest';
import { ACCOUNTS } from '../src/accounts.js';
import { tokenize } from '../src/pay.js';
import { totp } from '../src/totp.js';
import { browser } from './client.js';

const text = (r: Response) => r.text();

describe('pages + headers', () => {
  test('home lists products with security headers + noindex', async () => {
    const res = await browser().get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
    expect((await text(res)).match(/data-testid="product-card"/g)?.length).toBe(12);
  });
  test('unknown page → 404; search escapes input', async () => {
    const b = browser();
    expect((await b.get('/nope')).status).toBe(404);
    const body = await text(await b.get('/search?q=%3Cscript%3E'));
    expect(body).not.toContain('<script>');
    expect(body).toContain('No products match');
  });
  test('contact page allows Turnstile only there', async () => {
    const res = await browser().get('/contact');
    expect(res.headers.get('content-security-policy')).toContain('challenges.cloudflare.com');
    expect(await text(res)).toContain('3x00000000000000000000FF');
    expect((await browser().get('/')).headers.get('content-security-policy')).not.toContain('challenges');
  });
});

describe('variants', () => {
  test('normal vs drift add-to-cart button', async () => {
    expect(await text(await browser().get('/p/graphite-pencils'))).toContain('data-testid="add-to-cart">Add to cart<');
    const drift = await text(await browser({ VARIANT: 'drift' }).get('/p/graphite-pencils'));
    expect(drift).toContain('data-testid="add-to-bag">Add to bag<');
    expect(drift).not.toContain('Add to cart');
  });
});

describe('auth', () => {
  test('wrong password → 401 with message', async () => {
    const res = await browser().post('/login', { username: 'shopper', password: 'x' });
    expect(res.status).toBe(401);
    expect(await text(res)).toContain('Incorrect username or password.');
  });
  test('2FA account needs a valid code', async () => {
    const b = browser();
    const r1 = await b.post('/login?next=/orders', { username: 'shopper-2fa', password: 'fieldmark-demo' });
    expect(r1.headers.get('location')).toBe('/login/2fa?next=%2Forders');
    expect((await b.get('/orders')).status).toBe(303); // not signed in yet
    expect((await b.post('/login/2fa?next=%2Forders', { code: '000000' })).status).toBe(401);
    const secret = ACCOUNTS[1]!.totpSecret!;
    const ok = await b.post('/login/2fa?next=%2Forders', { code: await totp(secret) });
    expect(ok.headers.get('location')).toBe('/orders');
    expect((await b.get('/orders')).status).toBe(200);
  });
  test('next must be a local path', async () => {
    const res = await browser().post('/login?next=//evil.example', { username: 'shopper', password: 'fieldmark-demo' });
    expect(res.headers.get('location')).toBe('/');
  });
  test('a forged cookie is ignored', async () => {
    const res = await browser().request('/orders', { headers: { cookie: 'fm_session=eyJ1c2VyIjoic2hvcHBlciJ9.AAAA' } });
    expect(res.status).toBe(303);
  });
});

describe('checkout', () => {
  async function signedInWithCart() {
    const b = browser();
    await b.post('/login', { username: 'shopper', password: 'fieldmark-demo' });
    await b.post('/cart/add', { slug: 'field-notebook-3-pack', qty: '2' });
    return b;
  }
  const address = { name: 'Robin', address: '1 Trail Rd', city: 'Brno', postcode: '60200' };

  test('checkout requires sign-in', async () => {
    const b = browser();
    await b.post('/cart/add', { slug: 'graphite-pencils', qty: '1' });
    expect((await b.get('/checkout')).headers.get('location')).toBe('/login?next=/checkout');
  });

  test('pay with 4242 → order placed, cart cleared, CSV export', async () => {
    const b = await signedInWithCart();
    const page = await text(await b.get('/checkout'));
    expect(page).toContain('src="/pay/frame?amount=2900"');
    const tok = await b.json('/pay/tokenize', { number: '4242424242424242', expiry: '12/34', cvc: '123', amountCents: 2900 });
    const { token } = (await tok.json()) as { token: string };
    const placed = await b.post('/checkout', { ...address, pay_token: token });
    expect(placed.status).toBe(303);
    const loc = placed.headers.get('location')!;
    expect(loc).toMatch(/^\/orders\/FM-[A-Z0-9]{6}\?placed=1$/);
    const order = await text(await b.get(loc));
    expect(order).toContain('Thanks! Your order has been placed.');
    expect(order).toContain('data-testid="order-total">$29.00<');
    expect(await text(await b.get('/cart'))).toContain('Your cart is empty.');
    const csv = await b.get('/orders.csv');
    expect(csv.headers.get('content-disposition')).toContain('fieldmark-orders.csv');
    expect(await text(csv)).toContain('Field Notebook, 3-pack');
  });

  test('declined card → 402 from the card field', async () => {
    const b = await signedInWithCart();
    const res = await b.json('/pay/tokenize', { number: '4000000000000002', expiry: '12/34', cvc: '123', amountCents: 2900 });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, error: 'Your card was declined.' });
  });

  test('missing token or wrong amount refuses the order', async () => {
    const b = await signedInWithCart();
    expect((await b.post('/checkout', { ...address, pay_token: '' })).status).toBe(400);
    const wrong = await tokenize({ number: '4242424242424242', expiry: '12/34', cvc: '123', amountCents: 100 }, 'test-secret');
    if (!wrong.ok) throw new Error('setup');
    const res = await b.post('/checkout', { ...address, pay_token: wrong.token });
    expect(await text(res)).toContain('Your cart changed during checkout.');
  });
});

describe('engraving upload', () => {
  test('reports name + size, never stores', async () => {
    const fd = new FormData();
    fd.set('engraving', new File([new Uint8Array(3000)], 'logo.png', { type: 'image/png' }));
    const res = await browser().request('/engraving', { method: 'POST', body: fd });
    expect(res.status).toBe(200);
    expect(await text(res)).toContain('Received logo.png (3 KB).');
  });
  test('rejects non-images and empty uploads', async () => {
    const fd = new FormData();
    fd.set('engraving', new File(['hi'], 'a.txt', { type: 'text/plain' }));
    expect((await browser().request('/engraving', { method: 'POST', body: fd })).status).toBe(400);
    expect((await browser().request('/engraving', { method: 'POST', body: new FormData() })).status).toBe(400);
  });
});
