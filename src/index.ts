import { accountOf, checkPassword } from './accounts.js';
import { CHECKOUT_JS, FAVICON, PAY_JS } from './assets.js';
import { cartView, hasVariant, MAX_QTY, setQty } from './cart.js';
import { bySlug, CATEGORY_NAMES, type Category, PRODUCTS, search } from './catalog.js';
import { html, money, type Raw } from './html.js';
import { drawing, page, productCard } from './layout.js';
import { ordersCsv } from './orders.js';
import { readPayToken, tokenize } from './pay.js';
import {
  cartCount,
  loadSession,
  type Order,
  type Session,
  sessionCookie,
} from './session.js';
import { CSS, PAY_CSS } from './styles.js';
import { verifyTotp } from './totp.js';

/** Cloudflare Turnstile test keys: this sitekey ALWAYS shows an interactive challenge, which
 *  is the point — /contact is the shop's "a bot can't get through here" page. */
const TURNSTILE_SITEKEY = '3x00000000000000000000FF';
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const BASE_CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

const CONTACT_CSP = BASE_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
  .replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com")
  .replace("frame-src 'self'", "frame-src 'self' https://challenges.cloudflare.com");

interface Ctx {
  request: Request;
  url: URL;
  env: Env;
  session: Session;
  /** Set when the handler changed the session → a fresh Set-Cookie goes out. */
  dirty: boolean;
  variant: string;
}

type Handler = (c: Ctx, params: string[]) => Promise<Response> | Response;

const routes: [method: string, pattern: RegExp, handler: Handler][] = [];
const route = (method: string, pattern: RegExp, handler: Handler) =>
  routes.push([method, pattern, handler]);

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const session = await loadSession(request, env.SESSION_SECRET);
      const c: Ctx = { request, url, env, session, dirty: false, variant: String(env.VARIANT) };
      let res: Response | null = null;
      for (const [method, pattern, handler] of routes) {
        const m = pattern.exec(url.pathname);
        if (m && (method === request.method || (method === 'GET' && request.method === 'HEAD'))) {
          res = await handler(c, m.slice(1).map(decodeURIComponent));
          break;
        }
      }
      res ??= notFound(c);
      return await finish(c, res);
    } catch (err) {
      console.error(JSON.stringify({ msg: 'unhandled', path: url.pathname, err: String(err) }));
      return withSecurityHeaders(
        new Response('Something went wrong on our side. Try again in a moment.', {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
        url,
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function finish(c: Ctx, res: Response): Promise<Response> {
  const out = new Response(res.body, res);
  if (c.dirty) {
    out.headers.append(
      'set-cookie',
      await sessionCookie(c.session, c.env.SESSION_SECRET, c.url.protocol === 'https:'),
    );
  }
  return withSecurityHeaders(out, c.url);
}

function withSecurityHeaders(res: Response, url: URL): Response {
  const h = res.headers;
  if (!h.has('content-security-policy')) h.set('content-security-policy', BASE_CSP);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // A demo target: keep it out of search results.
  h.set('x-robots-tag', 'noindex, nofollow');
  if (url.protocol === 'https:') h.set('strict-transport-security', 'max-age=31536000');
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  return res;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function view(c: Ctx, title: string, body: Raw, opts: { status?: number; scripts?: string[]; csp?: string } = {}): Response {
  const doc = page(
    {
      title,
      path: c.url.pathname,
      user: c.session.user,
      cartCount: cartCount(c.session),
      repoUrl: c.env.REPO_URL || undefined,
    },
    body,
    { scripts: opts.scripts },
  );
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  if (opts.csp) headers.set('content-security-policy', opts.csp);
  return new Response(doc.toString(), { status: opts.status ?? 200, headers });
}

const redirect = (location: string, status = 303): Response =>
  new Response(null, { status, headers: { location } });

const asset = (body: string, type: string): Response =>
  new Response(body, {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=3600' },
  });

/** Only same-site relative paths survive as a post-login destination. */
function safeNext(next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

async function form(c: Ctx): Promise<FormData> {
  try {
    return await c.request.formData();
  } catch {
    return new FormData();
  }
}

const field = (f: FormData, name: string): string => {
  const v = f.get(name);
  return typeof v === 'string' ? v.trim() : '';
};

function notFound(c: Ctx): Response {
  return view(
    c,
    'Page not found',
    html`<h1>Page not found</h1><p class="lead">There's no page at <code>${c.url.pathname}</code>.</p><p><a class="button secondary" href="/">Back to the shop</a></p>`,
    { status: 404 },
  );
}

function orderId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `FM-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

// ── static ───────────────────────────────────────────────────────────────────

route('GET', /^\/assets\/site\.css$/, () => asset(CSS, 'text/css; charset=utf-8'));
route('GET', /^\/assets\/pay\.css$/, () => asset(PAY_CSS, 'text/css; charset=utf-8'));
route('GET', /^\/assets\/checkout\.js$/, () => asset(CHECKOUT_JS, 'text/javascript; charset=utf-8'));
route('GET', /^\/assets\/pay\.js$/, () => asset(PAY_JS, 'text/javascript; charset=utf-8'));
route('GET', /^\/favicon\.svg$/, () => asset(FAVICON, 'image/svg+xml'));
route('GET', /^\/robots\.txt$/, () => asset('User-agent: *\nAllow: /\n', 'text/plain; charset=utf-8'));
route('GET', /^\/healthz$/, (c) => Response.json({ ok: true, variant: c.variant }));

// ── catalogue ────────────────────────────────────────────────────────────────

const categoryChips = (active?: Category): Raw => html`<ul class="chips" aria-label="Categories">
  <li><a href="/"${active ? '' : html` aria-current="page"`}>All</a></li>
  ${(Object.keys(CATEGORY_NAMES) as Category[]).map(
    (k) => html`<li><a href="/c/${k}"${active === k ? html` aria-current="page"` : ''}>${CATEGORY_NAMES[k]}</a></li>`,
  )}
</ul>`;

route('GET', /^\/$/, (c) =>
  view(
    c,
    'Field notebooks and pencils',
    html`<section class="hero">
  <div>
    <h1>Paper and pencils that work outside.</h1>
    <p class="lead">Field notebooks, waterproof paper, compasses and the small tools that go with them. A demo shop — browse, sign in and check out with a test card.</p>
    <p><a class="button" href="/c/notebooks">Shop notebooks</a></p>
  </div>
  <svg class="contours" viewBox="0 0 400 240" aria-hidden="true">
    <rect width="400" height="240" rx="6" fill="#f1f4f1"/>
    ${[0, 1, 2, 3, 4, 5].map(
      (i) => html`<path d="M-10 ${190 - i * 28}c60-${30 + i * 4} 120 ${20 - i * 3} 180-${10 + i * 6}s140-${40 - i * 5} 240 ${8 + i * 2}" fill="none" stroke="${i === 3 ? '#c84a17' : '#9fb1a5'}" stroke-width="${i === 3 ? 2.5 : 1.5}"/>`,
    )}
    <circle cx="282" cy="96" r="5" fill="#1e2f27"/>
  </svg>
</section>
${categoryChips()}
<ul class="grid">${PRODUCTS.map(productCard)}</ul>`,
  ),
);

route('GET', /^\/c\/([a-z]+)$/, (c, [cat]) => {
  if (!cat || !(cat in CATEGORY_NAMES)) return notFound(c);
  const category = cat as Category;
  return view(
    c,
    CATEGORY_NAMES[category],
    html`<h1>${CATEGORY_NAMES[category]}</h1>${categoryChips(category)}
<ul class="grid">${PRODUCTS.filter((p) => p.category === category).map(productCard)}</ul>`,
  );
});

route('GET', /^\/search$/, (c) => {
  const q = (c.url.searchParams.get('q') ?? '').slice(0, 100);
  const results = search(q);
  return view(
    c,
    q ? `Search: ${q}` : 'Search',
    html`<h1>Search</h1>
<form role="search" action="/search" method="get" class="field">
  <label for="search-q">Search products</label>
  <input id="search-q" type="search" name="q" value="${q}">
  <button type="submit">Search</button>
</form>
${
  q
    ? results.length
      ? html`<p class="muted" data-testid="search-summary">${results.length} ${results.length === 1 ? 'result' : 'results'} for “${q}”</p><ul class="grid">${results.map(productCard)}</ul>`
      : html`<p class="notice" data-testid="search-summary">No products match “${q}”. Try “notebook” or “pencil”.</p>`
    : ''
}`,
  );
});

route('GET', /^\/p\/([a-z0-9-]+)$/, (c, [slug]) => {
  const p = bySlug(slug ?? '');
  if (!p) return notFound(c);
  // drift variant = an ordinary UI change (copy + test id), the kind a locator fix handles.
  const drift = hasVariant(c.variant, 'drift');
  return view(
    c,
    p.name,
    html`<div class="product">
  <div class="swatch">${drawing(p)}</div>
  <div>
    <p class="muted"><a href="/c/${p.category}">${CATEGORY_NAMES[p.category]}</a></p>
    <h1>${p.name}</h1>
    <p class="price" data-testid="product-price">${money(p.priceCents)}</p>
    <p>${p.blurb}</p>
    <form method="post" action="/cart/add">
      <input type="hidden" name="slug" value="${p.slug}">
      <div class="field">
        <label for="qty">Quantity</label>
        <input id="qty" type="number" name="qty" value="1" min="1" max="${MAX_QTY}">
      </div>
      <button type="submit" data-testid="${drift ? 'add-to-bag' : 'add-to-cart'}">${drift ? 'Add to bag' : 'Add to cart'}</button>
    </form>
    ${p.engravable ? html`<p class="hint">Want it engraved? <a href="/engraving">Upload an engraving image</a>.</p>` : ''}
  </div>
</div>`,
  );
});

// ── cart ─────────────────────────────────────────────────────────────────────

route('POST', /^\/cart\/add$/, async (c) => {
  const f = await form(c);
  const slug = field(f, 'slug');
  const qty = Number(field(f, 'qty') || '1');
  if (!bySlug(slug) || !Number.isFinite(qty) || qty < 1) return redirect('/cart');
  setQty(c.session, slug, (c.session.cart[slug] ?? 0) + qty);
  c.dirty = true;
  return redirect(`/cart?added=${encodeURIComponent(slug)}`);
});

route('POST', /^\/cart\/update$/, async (c) => {
  const f = await form(c);
  const qty = Number(field(f, 'qty'));
  if (Number.isFinite(qty)) {
    setQty(c.session, field(f, 'slug'), qty);
    c.dirty = true;
  }
  return redirect('/cart');
});

route('POST', /^\/cart\/remove$/, async (c) => {
  const f = await form(c);
  setQty(c.session, field(f, 'slug'), 0);
  c.dirty = true;
  return redirect('/cart');
});

function totals(v: ReturnType<typeof cartView>): Raw {
  return html`<dl class="totals" data-testid="cart-totals">
  <dt>Subtotal</dt><dd data-testid="cart-subtotal">${money(v.subtotalCents)}</dd>
  <dt>Shipping</dt><dd data-testid="cart-shipping">${money(v.shippingCents)}</dd>
  <dt class="grand">Total</dt><dd class="grand" data-testid="cart-total">${money(v.totalCents)}</dd>
</dl>`;
}

route('GET', /^\/cart$/, (c) => {
  const v = cartView(c.session, c.variant);
  const added = bySlug(c.url.searchParams.get('added') ?? '');
  if (v.lines.length === 0) {
    return view(
      c,
      'Cart',
      html`<h1>Your cart</h1><p class="lead">Your cart is empty.</p><p><a class="button" href="/">Browse the shop</a></p>`,
    );
  }
  return view(
    c,
    'Cart',
    html`<h1>Your cart</h1>
${added ? html`<p class="notice ok" role="status">Added ${added.name} to your cart.</p>` : ''}
<table class="lines">
  <thead><tr><th>Item</th><th class="num">Price</th><th>Quantity</th><th class="num">Line total</th><th><span class="skip">Remove</span></th></tr></thead>
  <tbody>
  ${v.lines.map(
    (l) => html`<tr data-testid="cart-line">
    <td><a href="/p/${l.slug}">${l.name}</a></td>
    <td class="num">${money(l.priceCents)}</td>
    <td><form method="post" action="/cart/update" class="inline">
      <input type="hidden" name="slug" value="${l.slug}">
      <label class="skip" for="qty-${l.slug}">Quantity for ${l.name}</label>
      <input id="qty-${l.slug}" type="number" name="qty" value="${l.qty}" min="0" max="${MAX_QTY}">
      <button type="submit" class="secondary">Update</button>
    </form></td>
    <td class="num">${money(l.qty * l.priceCents)}</td>
    <td><form method="post" action="/cart/remove" class="inline"><input type="hidden" name="slug" value="${l.slug}"><button type="submit" class="link" aria-label="Remove ${l.name}">Remove</button></form></td>
  </tr>`,
  )}
  </tbody>
</table>
${totals(v)}
<p><a class="button" href="/checkout">Check out</a> <a class="button secondary" href="/">Keep shopping</a></p>`,
  );
});

// ── auth ─────────────────────────────────────────────────────────────────────

function loginForm(c: Ctx, error?: string, username = ''): Response {
  const next = safeNext(c.url.searchParams.get('next'));
  return view(
    c,
    'Sign in',
    html`<h1>Sign in</h1>
<p class="lead">Use a demo account: <strong>shopper</strong> / <strong>fieldmark-demo</strong>. The 2FA account and its authenticator secret are in the README.</p>
${error ? html`<p class="notice error" role="alert">${error}</p>` : ''}
<form method="post" action="/login?next=${encodeURIComponent(next)}">
  <div class="field"><label for="username">Username</label><input id="username" name="username" type="text" autocomplete="username" required value="${username}"></div>
  <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
  <button type="submit">Sign in</button>
</form>`,
    { status: error ? 401 : 200 },
  );
}

route('GET', /^\/login$/, (c) => (c.session.user ? redirect('/orders') : loginForm(c)));

route('POST', /^\/login$/, async (c) => {
  const f = await form(c);
  const username = field(f, 'username');
  const account = checkPassword(username, String(f.get('password') ?? ''));
  if (!account) return loginForm(c, 'Incorrect username or password.', username);
  const next = safeNext(c.url.searchParams.get('next'));
  c.dirty = true;
  if (account.totpSecret) {
    c.session.pending2fa = account.username;
    delete c.session.user;
    return redirect(`/login/2fa?next=${encodeURIComponent(next)}`);
  }
  c.session.user = account.username;
  delete c.session.pending2fa;
  return redirect(next);
});

function otpForm(c: Ctx, error?: string): Response {
  const next = safeNext(c.url.searchParams.get('next'));
  return view(
    c,
    'Two-factor authentication',
    html`<h1>Enter your authentication code</h1>
<p class="lead">Open your authenticator app and enter the 6-digit code for Fieldmark.</p>
${error ? html`<p class="notice error" role="alert">${error}</p>` : ''}
<form method="post" action="/login/2fa?next=${encodeURIComponent(next)}">
  <div class="field"><label for="otp">Authentication code</label><input id="otp" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div>
  <button type="submit">Verify</button>
</form>`,
    { status: error ? 401 : 200 },
  );
}

route('GET', /^\/login\/2fa$/, (c) => (c.session.pending2fa ? otpForm(c) : redirect('/login')));

route('POST', /^\/login\/2fa$/, async (c) => {
  const account = accountOf(c.session.pending2fa);
  if (!account?.totpSecret) return redirect('/login');
  const f = await form(c);
  if (!(await verifyTotp(account.totpSecret, field(f, 'code')))) {
    return otpForm(c, "That code didn't work. Check your authenticator app and try again.");
  }
  c.session.user = account.username;
  delete c.session.pending2fa;
  c.dirty = true;
  return redirect(safeNext(c.url.searchParams.get('next')));
});

route('POST', /^\/logout$/, (c) => {
  delete c.session.user;
  delete c.session.pending2fa;
  c.dirty = true;
  return redirect('/');
});

// ── checkout + hosted card field ─────────────────────────────────────────────

function checkoutPage(c: Ctx, error?: string, values: Record<string, string> = {}): Response {
  const v = cartView(c.session, c.variant);
  const account = accountOf(c.session.user);
  const label = `Pay ${money(v.totalCents)}`;
  return view(
    c,
    'Checkout',
    html`<h1>Checkout</h1>
${error ? html`<p class="notice error" role="alert">${error}</p>` : ''}
<div class="checkout">
  <form id="checkout" method="post" action="/checkout">
    <h2>Shipping address</h2>
    <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" autocomplete="name" required value="${values.name ?? account?.displayName ?? ''}"></div>
    <div class="field"><label for="address">Street address</label><input id="address" name="address" type="text" autocomplete="street-address" required value="${values.address ?? ''}"></div>
    <div class="field"><label for="city">City</label><input id="city" name="city" type="text" autocomplete="address-level2" required value="${values.city ?? ''}"></div>
    <div class="field"><label for="postcode">Postcode</label><input id="postcode" name="postcode" type="text" autocomplete="postal-code" required value="${values.postcode ?? ''}"></div>
    <h2>Payment</h2>
    <p class="hint">Test card: 4242 4242 4242 4242, any future expiry, any 3-digit CVC.</p>
    <iframe id="payframe" class="payframe" title="Secure card payment input frame" src="/pay/frame?amount=${v.totalCents}"></iframe>
    <input type="hidden" id="pay_token" name="pay_token">
    <p><button id="place-order" type="submit" data-testid="place-order" data-label="${label}">${label}</button></p>
  </form>
  <aside class="panel" aria-label="Order summary">
    <h2>Order summary</h2>
    <ul>${v.lines.map((l) => html`<li>${l.qty} × ${l.name}</li>`)}</ul>
    ${totals(v)}
  </aside>
</div>`,
    { scripts: ['/assets/checkout.js'], status: error ? 400 : 200 },
  );
}

route('GET', /^\/checkout$/, (c) => {
  if (!c.session.user) return redirect('/login?next=/checkout');
  if (cartView(c.session, c.variant).lines.length === 0) return redirect('/cart');
  return checkoutPage(c);
});

route('POST', /^\/checkout$/, async (c) => {
  if (!c.session.user) return redirect('/login?next=/checkout');
  const v = cartView(c.session, c.variant);
  if (v.lines.length === 0) return redirect('/cart');
  const f = await form(c);
  const values = Object.fromEntries(
    ['name', 'address', 'city', 'postcode'].map((k) => [k, field(f, k).slice(0, 200)]),
  );
  if (Object.values(values).some((x) => !x)) {
    return checkoutPage(c, 'Fill in your full shipping address.', values);
  }
  const pay = await readPayToken(field(f, 'pay_token'), c.env.SESSION_SECRET);
  if (!pay) return checkoutPage(c, 'Payment was not completed. Enter your card details and try again.', values);
  if (pay.amountCents !== v.totalCents) {
    return checkoutPage(c, 'Your cart changed during checkout. Review the total and pay again.', values);
  }
  const order: Order = {
    id: orderId(),
    placedAt: new Date().toISOString(),
    lines: v.lines.map(({ slug, name, qty, priceCents }) => ({ slug, name, qty, priceCents })),
    subtotalCents: v.subtotalCents,
    shippingCents: v.shippingCents,
    totalCents: v.totalCents,
    cardLast4: pay.last4,
  };
  c.session.orders = [order, ...c.session.orders];
  c.session.cart = {};
  c.dirty = true;
  return redirect(`/orders/${order.id}?placed=1`);
});

route('GET', /^\/pay\/frame$/, (c) => {
  const amount = Math.max(0, Math.floor(Number(c.url.searchParams.get('amount') ?? '0')) || 0);
  const doc = html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Card payment</title><link rel="stylesheet" href="/assets/pay.css"></head>
<body data-amount="${amount}">
  <label for="cardnumber">Card number</label>
  <input id="cardnumber" name="cardnumber" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234">
  <div class="row">
    <div><label for="exp-date">Expiration (MM / YY)</label><input id="exp-date" name="exp-date" autocomplete="cc-exp" placeholder="MM / YY"></div>
    <div><label for="cvc">CVC</label><input id="cvc" name="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC"></div>
  </div>
  <p id="card-errors" class="err" role="alert"></p>
  <p class="brand">Payments by FieldPay (demo — no real charges)</p>
  <script src="/assets/pay.js" defer></script>
</body></html>`;
  return new Response(doc.toString(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
});

route('POST', /^\/pay\/tokenize$/, async (c) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await c.request.json()) as Record<string, unknown>;
  } catch {
    // fall through to validation errors
  }
  const result = await tokenize(
    {
      number: String(body.number ?? ''),
      expiry: String(body.expiry ?? ''),
      cvc: String(body.cvc ?? ''),
      amountCents: Number(body.amountCents) || 0,
    },
    c.env.SESSION_SECRET,
  );
  return Response.json(result, { status: result.ok ? 200 : 402 });
});

// ── orders ───────────────────────────────────────────────────────────────────

route('GET', /^\/orders$/, (c) => {
  if (!c.session.user) return redirect('/login?next=/orders');
  const orders = c.session.orders;
  return view(
    c,
    'Orders',
    html`<h1>Your orders</h1>
${
  orders.length === 0
    ? html`<p class="lead">No orders yet.</p>`
    : html`<table class="lines">
  <thead><tr><th>Order</th><th>Placed</th><th class="num">Items</th><th class="num">Total</th></tr></thead>
  <tbody>${orders.map(
    (o) => html`<tr data-testid="order-row"><td><a href="/orders/${o.id}">${o.id}</a></td><td>${o.placedAt.slice(0, 10)}</td><td class="num">${o.lines.reduce((n, l) => n + l.qty, 0)}</td><td class="num">${money(o.totalCents)}</td></tr>`,
  )}</tbody>
</table>
<p><a class="button secondary" href="/orders.csv" download>Download orders (CSV)</a></p>`
}`,
  );
});

route('GET', /^\/orders\.csv$/, (c) => {
  if (!c.session.user) return redirect('/login?next=/orders');
  return new Response(ordersCsv(c.session.orders), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="fieldmark-orders.csv"',
    },
  });
});

route('GET', /^\/orders\/(FM-[A-Z0-9]+)$/, (c, [id]) => {
  if (!c.session.user) return redirect(`/login?next=/orders/${id}`);
  const o = c.session.orders.find((x) => x.id === id);
  if (!o) return notFound(c);
  return view(
    c,
    `Order ${o.id}`,
    html`${c.url.searchParams.has('placed') ? html`<p class="notice ok" role="status">Thanks! Your order has been placed.</p>` : ''}
<h1>Order ${o.id}</h1>
<p class="muted">Placed ${o.placedAt.slice(0, 16).replace('T', ' ')} UTC · paid with card ending ${o.cardLast4}</p>
<table class="lines"><thead><tr><th>Item</th><th class="num">Quantity</th><th class="num">Line total</th></tr></thead>
<tbody>${o.lines.map((l) => html`<tr><td>${l.name}</td><td class="num">${l.qty}</td><td class="num">${money(l.qty * l.priceCents)}</td></tr>`)}</tbody></table>
<dl class="totals"><dt>Subtotal</dt><dd>${money(o.subtotalCents)}</dd><dt>Shipping</dt><dd>${money(o.shippingCents)}</dd><dt class="grand">Total</dt><dd class="grand" data-testid="order-total">${money(o.totalCents)}</dd></dl>
<p><a href="/orders">All orders</a></p>`,
  );
});

// ── engraving upload (ephemeral) ─────────────────────────────────────────────

function engravingPage(c: Ctx, notice?: Raw, status = 200): Response {
  return view(
    c,
    'Engraving',
    html`<h1>Engraving</h1>
<p class="lead">Upload an image for the engravable pen and we'll confirm we received it. Files are read once and thrown away: nothing is stored or shown back.</p>
${notice ?? ''}
<form method="post" action="/engraving" enctype="multipart/form-data">
  <div class="field">
    <label for="engraving">Engraving image</label>
    <input id="engraving" name="engraving" type="file" accept="image/png,image/jpeg,image/svg+xml" required>
    <p class="hint">PNG, JPG or SVG, up to 2 MB.</p>
  </div>
  <button type="submit">Upload image</button>
</form>`,
    { status },
  );
}

route('GET', /^\/engraving$/, (c) => engravingPage(c));

route('POST', /^\/engraving$/, async (c) => {
  const declared = Number(c.request.headers.get('content-length') ?? '0');
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return engravingPage(c, html`<p class="notice error" role="alert">That file is larger than 2 MB.</p>`, 400);
  }
  const f = await form(c);
  const file = f.get('engraving');
  if (!(file instanceof File) || file.size === 0) {
    return engravingPage(c, html`<p class="notice error" role="alert">Choose an image to upload.</p>`, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return engravingPage(c, html`<p class="notice error" role="alert">That file is larger than 2 MB.</p>`, 400);
  }
  if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) {
    return engravingPage(c, html`<p class="notice error" role="alert">Upload a PNG, JPG or SVG image.</p>`, 400);
  }
  // Deliberately discarded — the shop never stores or serves uploads.
  const kb = Math.max(1, Math.round(file.size / 1024));
  return engravingPage(
    c,
    html`<p class="notice ok" role="status" data-testid="upload-result">Received ${file.name} (${kb} KB). We'll use it for your engraving preview.</p>`,
  );
});

// ── contact (Turnstile: always challenges) ───────────────────────────────────

function contactPage(c: Ctx, notice?: Raw): Response {
  return view(
    c,
    'Contact',
    html`<h1>Contact us</h1>
<p class="lead">This form uses a CAPTCHA that always asks for a human check.</p>
${notice ?? ''}
<form method="post" action="/contact">
  <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" type="text" required></div>
  <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required></div>
  <div class="field"><label for="c-message">Message</label><textarea id="c-message" name="message" required></textarea></div>
  <div class="field"><div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}"></div></div>
  <button type="submit">Send message</button>
</form>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`,
    { csp: CONTACT_CSP },
  );
}

route('GET', /^\/contact$/, (c) => contactPage(c));

route('POST', /^\/contact$/, async (c) => {
  const f = await form(c);
  const token = field(f, 'cf-turnstile-response');
  let ok = false;
  if (token) {
    const body = new FormData();
    body.set('secret', TURNSTILE_TEST_SECRET);
    body.set('response', token);
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5000),
      });
      ok = ((await res.json()) as { success?: boolean }).success === true;
    } catch {
      ok = false;
    }
  }
  return contactPage(
    c,
    ok
      ? html`<p class="notice ok" role="status">Thanks — message received. (It isn't sent anywhere; this is a demo.)</p>`
      : html`<p class="notice error" role="alert">Complete the human check before sending.</p>`,
  );
});
