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

Switches combine: `VARIANT=drift,bug`. A non-normal variant names itself in the page footer.

### Hosted variants

Each variant runs as its own Worker on its own host (a query string or cookie switch would not survive
`page.goto('/')` or a fresh browser context). `wrangler.jsonc` has one environment per variant:

| Variant | Worker | Host |
|---|---|---|
| `normal` | `testwatch-demo-shop` | `https://testwatch-demo-shop.<account>.workers.dev` |
| `drift` | `testwatch-demo-shop-drift` (`--env drift`) | `https://testwatch-demo-shop-drift.<account>.workers.dev` |
| `bug` | `testwatch-demo-shop-bug` (`--env bug`) | `https://testwatch-demo-shop-bug.<account>.workers.dev` |

TestWatch's signup demo app points one environment at each host (`DEMO_SHOP_URL`, `DEMO_SHOP_DRIFT_URL`,
`DEMO_SHOP_BUG_URL`). Every workspace shares the public `shopper-2fa` account — that is safe: the shop keeps
no server-side state (cart, sign-in and orders live in each visitor's signed cookie) and the 2FA code is
computed from the published secret, so one workspace can't see or change another's session.

## Run it

```sh
pnpm install
cp .dev.vars.example .dev.vars   # set SESSION_SECRET to a long random string
pnpm dev                         # http://localhost:8787
pnpm test                        # runs inside the Workers runtime
```

Deploy (free `*.workers.dev`):

```sh
pnpm wrangler secret put SESSION_SECRET                 # once per Worker, each its own value
pnpm wrangler secret put SESSION_SECRET --env drift
pnpm wrangler secret put SESSION_SECRET --env bug
pnpm run deploy:all                                     # normal + drift + bug
```

Locally: `pnpm dev` (normal, :8787), `pnpm dev:drift` (:8788), `pnpm dev:bug` (:8789) — each keeps its own
local state, so all three can run at once.

## License

MIT
