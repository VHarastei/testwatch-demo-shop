# Fieldmark Supply — a demo shop for end-to-end testing

A small, realistic online shop you can point an end-to-end testing tool at: [TestWatch](https://testwatch.dev),
Playwright, or anything else. Nothing is for sale and no real payments are taken.

It runs as a single Cloudflare Worker with no database: the cart, sign-in and orders live in one signed cookie,
so every visitor gets their own shop and nothing is shared.

## What's in it

| Flow | Where | The usual testing gotcha |
|---|---|---|
| Browse + categories | `/`, `/c/:category`, `/p/:slug` | — |
| Search | `/search?q=` | empty results state |
| Cart | `/cart` | quantities, totals with shipping |
| Sign in | `/login` | wrong password message |
| Sign in with 2FA | `/login` → `/login/2fa` | TOTP codes |
| Checkout | `/checkout` | the card form lives in an **iframe** (like Stripe), declined cards |
| Orders + CSV export | `/orders`, `/orders.csv` | asserting a downloaded file |
| File upload | `/engraving` | uploading a file (it is read and discarded, never stored) |
| CAPTCHA | `/contact` | Cloudflare Turnstile that **always** challenges — automation should stop and report it |

## Demo accounts

These are public on purpose. Don't reuse them anywhere.

| Username | Password | 2FA |
|---|---|---|
| `shopper` | `fieldmark-demo` | — |
| `shopper-2fa` | `fieldmark-demo` | TOTP secret `GZ4FORKTNBVFGQTFJJGEIRDOKY` (SHA-1, 6 digits, 30 s) |

## Test cards

| Number | Result |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 0002` | "Your card was declined." |

Any future expiry (`MM / YY`) and any 3-digit CVC.

## Variants

The `VARIANT` variable switches the shop into a deliberately changed version, for showing how a testing tool
reacts:

- `normal` — the default.
- `drift` — an ordinary UI change: the "Add to cart" button becomes "Add to bag" (and its test id changes).
  A good tool updates the locator and asks you first.
- `bug` — a real bug: the cart total leaves out shipping. A good tool reports a bug instead of "fixing" the test.

Switches combine: `VARIANT=drift,bug`.

## Run it

```sh
pnpm install
cp .dev.vars.example .dev.vars   # set SESSION_SECRET to a long random string
pnpm dev                         # http://localhost:8787
pnpm test                        # runs inside the Workers runtime
```

Deploy (free `*.workers.dev`):

```sh
pnpm wrangler secret put SESSION_SECRET
pnpm run deploy
pnpm wrangler deploy --var VARIANT:drift   # temporarily switch variant; deploy again to go back
```

## License

MIT
