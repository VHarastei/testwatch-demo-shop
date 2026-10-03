import { CATEGORY_NAMES, type Product } from './catalog.js';
import { html, money, type Raw, raw } from './html.js';

export interface PageCtx {
  title: string;
  path: string;
  user?: string;
  cartCount: number;
  /** Public source repo; the footer links it when set (REPO_URL var). */
  repoUrl?: string;
}

const NAV: [string, string][] = [
  ['/', 'Shop'],
  ['/engraving', 'Engraving'],
  ['/contact', 'Contact'],
];

/** Topographic contour mark — Fieldmark's logo. */
export const mark = (size = 28): Raw => html`<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <rect width="32" height="32" rx="6" fill="#1e2f27"/>
  <path d="M6 22c4-6 8-1 12-6s6-6 8-4" fill="none" stroke="#f1f4f1" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 15c3-4 6-1 9-4s5-4 7-3" fill="none" stroke="#c84a17" stroke-width="2" stroke-linecap="round"/>
  <circle cx="22" cy="23" r="2" fill="#f1f4f1"/>
</svg>`;

export function page(ctx: PageCtx, body: Raw, opts: { scripts?: string[] } = {}): Raw {
  const current = (href: string): Raw =>
    (href === '/' ? ctx.path === '/' || ctx.path.startsWith('/c/') || ctx.path.startsWith('/p/') : ctx.path.startsWith(href))
      ? raw(' aria-current="page"')
      : raw('');
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ctx.title} · Fieldmark Supply</title>
<meta name="description" content="Fieldmark Supply is a demo shop for trying end-to-end testing tools. Nothing here is for sale.">
<link rel="stylesheet" href="/assets/site.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
  <a class="brand" href="/">${mark()} Fieldmark <small>Supply</small></a>
  <form class="searchbar" role="search" action="/search" method="get">
    <label for="q" class="skip">Search products</label>
    <input id="q" type="search" name="q" placeholder="Search notebooks, pencils…">
    <button type="submit" class="secondary">Search</button>
  </form>
  <nav class="main" aria-label="Main">
    ${NAV.map(([href, label]) => html`<a href="${href}"${current(href)}>${label}</a>`)}
    ${ctx.user ? html`<a href="/orders"${current('/orders')}>Orders</a>` : ''}
    <a href="/cart"${current('/cart')}>Cart <span class="pill" data-testid="cart-count" aria-label="${ctx.cartCount} items in cart">${ctx.cartCount}</span></a>
    ${
      ctx.user
        ? html`<form class="inline" method="post" action="/logout"><button class="link" type="submit">Sign out</button></form>`
        : html`<a href="/login"${current('/login')}>Sign in</a>`
    }
  </nav>
</div></header>
<main id="main"><div class="wrap">
${body}
</div></main>
<footer class="site"><div class="wrap">
  <span>Fieldmark Supply is a demo shop for end-to-end testing. Nothing is for sale and no real payments are taken.</span>
  <span>${ctx.repoUrl ? html`<a href="${ctx.repoUrl}">Source code (MIT)</a> · ` : ''}Made for <a href="https://testwatch.dev">TestWatch</a></span>
</div></footer>
${(opts.scripts ?? []).map((src) => html`<script src="${src}" defer></script>`)}
</body>
</html>`;
}

/** A simple drawn product, so the shop needs no image hosting. */
export function drawing(p: Product): Raw {
  if (p.slug === 'steel-pocket-ruler') {
    return html`<svg viewBox="0 0 120 90" aria-hidden="true"><g transform="rotate(-18 60 45)"><rect x="10" y="34" width="100" height="22" rx="2" fill="${p.color}"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((i) => html`<rect x="${15 + i * 5}" y="34" width="1.2" height="${i % 2 ? 6 : 10}" fill="#1e2f27"/>`)}</g></svg>`;
  }
  if (p.slug === 'brass-sharpener') {
    return html`<svg viewBox="0 0 120 90" aria-hidden="true"><rect x="38" y="24" width="44" height="42" rx="6" fill="${p.color}"/><circle cx="60" cy="45" r="9" fill="#1e2f27"/><rect x="44" y="28" width="32" height="5" rx="1" fill="#d9b56a"/></svg>`;
  }
  switch (p.category) {
    case 'notebooks':
      return html`<svg viewBox="0 0 120 90" aria-hidden="true"><rect x="28" y="6" width="64" height="78" rx="4" fill="${p.color}"/><rect x="28" y="6" width="8" height="78" fill="rgba(0,0,0,.18)"/><rect x="78" y="6" width="4" height="78" fill="#1e2f27" opacity=".7"/><rect x="44" y="22" width="30" height="10" rx="1" fill="#fff" opacity=".85"/></svg>`;
    case 'writing':
      return html`<svg viewBox="0 0 120 90" aria-hidden="true"><g transform="rotate(-28 60 45)"><rect x="14" y="38" width="80" height="14" rx="2" fill="${p.color}"/><polygon points="94,38 110,45 94,52" fill="#e9d2a8"/><polygon points="104,42.5 110,45 104,47.5" fill="#1e2f27"/><rect x="8" y="38" width="8" height="14" rx="2" fill="#c9c9c9"/></g></svg>`;
    case 'navigation':
      return html`<svg viewBox="0 0 120 90" aria-hidden="true"><rect x="22" y="10" width="76" height="70" rx="8" fill="#fff" stroke="${p.color}" stroke-width="4"/><circle cx="60" cy="45" r="24" fill="none" stroke="#1e2f27" stroke-width="2"/><polygon points="60,23 65,45 60,67 55,45" fill="${p.color}"/><circle cx="60" cy="45" r="3" fill="#1e2f27"/></svg>`;
    case 'carry':
      return html`<svg viewBox="0 0 120 90" aria-hidden="true"><rect x="22" y="14" width="76" height="66" rx="6" fill="${p.color}"/><path d="M22 34h76" stroke="rgba(0,0,0,.25)" stroke-width="3"/><rect x="54" y="30" width="12" height="16" rx="2" fill="#e8e1d2"/></svg>`;
  }
}

export function productCard(p: Product): Raw {
  return html`<li class="card" data-testid="product-card">
  <a href="/p/${p.slug}" class="swatch" tabindex="-1" aria-hidden="true">${drawing(p)}<span class="tag">${money(p.priceCents)}</span></a>
  <a class="title" href="/p/${p.slug}">${p.name}</a>
  <span class="flag">${CATEGORY_NAMES[p.category]}${p.engravable ? ' · engravable' : ''}</span>
</li>`;
}
