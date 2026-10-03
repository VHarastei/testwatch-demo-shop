/** One stylesheet, served at /assets/site.css. Fieldmark: white paper, pine ink, one
 *  safety-orange for actions, product swatches carry the rest of the colour. */
export const CSS = `
:root {
  --paper: #ffffff;
  --wash: #f1f4f1;
  --ink: #1e2f27;
  --muted: #56645b;
  --line: #d6ddd7;
  --act: #c84a17;
  --act-ink: #ffffff;
  --ok: #24704a;
  --err: #b3261e;
  --radius: 4px;
  --font: "Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.55 var(--font); }
a { color: inherit; text-underline-offset: 3px; }
a:hover { color: var(--act); }
:focus-visible { outline: 3px solid var(--act); outline-offset: 2px; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 12px; top: 12px; background: var(--paper); padding: 8px; z-index: 2; }

header.site { border-bottom: 1px solid var(--line); }
header.site .wrap { display: flex; align-items: center; gap: 24px; min-height: 68px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
.brand small { font-weight: 500; color: var(--muted); font-size: 14px; }
nav.main { display: flex; gap: 18px; flex-wrap: wrap; margin-left: auto; align-items: center; }
nav.main a { text-decoration: none; font-weight: 500; }
nav.main a[aria-current="page"] { text-decoration: underline; text-decoration-thickness: 2px; }
.pill { display: inline-block; min-width: 22px; padding: 0 6px; border-radius: 11px; background: var(--ink); color: var(--paper); font-size: 13px; text-align: center; }
form.inline { display: inline; margin: 0; }
.searchbar { display: flex; gap: 8px; }
.searchbar input { width: 220px; }

main { padding: 32px 0 64px; min-height: 60vh; }
h1 { font-size: 34px; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 12px; }
h2 { font-size: 22px; line-height: 1.25; margin: 32px 0 12px; }
p.lead { font-size: 18px; color: var(--muted); max-width: 60ch; margin: 0 0 24px; }
.muted { color: var(--muted); }

.hero { display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; align-items: center; padding: 8px 0 24px; }
.hero h1 { font-size: 44px; }
.hero .contours { width: 100%; height: auto; }
@media (max-width: 760px) { .hero { grid-template-columns: 1fr; } .hero h1 { font-size: 34px; } }

.chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 20px; padding: 0; list-style: none; }
.chips a { display: inline-block; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; text-decoration: none; }
.chips a[aria-current="page"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; list-style: none; padding: 0; margin: 0; }
.card { display: flex; flex-direction: column; gap: 8px; }
.card a.title { font-weight: 600; text-decoration: none; }
.swatch { position: relative; aspect-ratio: 4 / 3; border-radius: var(--radius); background: var(--wash); display: grid; place-items: center; overflow: hidden; }
.swatch svg { width: 62%; height: auto; }
.tag { position: absolute; top: 10px; right: 10px; background: var(--paper); border: 1px solid var(--line); border-radius: 3px; padding: 2px 8px 2px 18px; font-weight: 600; font-size: 14px; }
.tag::before { content: ""; position: absolute; left: 6px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; border: 1.5px solid var(--muted); }
.flag { font-size: 13px; color: var(--muted); }

.product { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.product .swatch { aspect-ratio: 1; }
.price { font-size: 24px; font-weight: 700; margin: 8px 0 16px; }
@media (max-width: 760px) { .product { grid-template-columns: 1fr; } }

label { display: block; font-weight: 600; margin: 0 0 6px; }
.field { margin: 0 0 16px; }
.hint { font-size: 14px; color: var(--muted); margin-top: 4px; }
input[type=text], input[type=password], input[type=email], input[type=search], input[type=number], textarea, select {
  font: inherit; color: inherit; width: 100%; max-width: 420px; padding: 9px 12px; border: 1px solid #b7c2ba; border-radius: var(--radius); background: var(--paper);
}
input[type=number] { width: 88px; }
textarea { min-height: 120px; }
button, .button {
  font: inherit; font-weight: 600; display: inline-block; padding: 10px 18px; border-radius: var(--radius); border: 1px solid var(--act); background: var(--act); color: var(--act-ink); cursor: pointer; text-decoration: none;
}
button.secondary, .button.secondary { background: var(--paper); color: var(--ink); border-color: #b7c2ba; }
button.link { background: none; border: 0; padding: 0; color: inherit; font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
button:disabled { opacity: .55; cursor: not-allowed; }

.notice { border-left: 4px solid var(--ink); background: var(--wash); padding: 12px 16px; margin: 0 0 20px; max-width: 640px; }
.notice.error { border-color: var(--err); }
.notice.ok { border-color: var(--ok); }

table.lines { width: 100%; max-width: 760px; border-collapse: collapse; margin: 0 0 20px; }
table.lines th, table.lines td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
table.lines td.num, table.lines th.num { text-align: right; font-variant-numeric: tabular-nums; }
.totals { max-width: 760px; display: grid; grid-template-columns: 1fr auto; gap: 4px 24px; margin: 0 0 24px; font-variant-numeric: tabular-nums; }
.totals .grand { font-weight: 700; font-size: 20px; padding-top: 8px; border-top: 1px solid var(--line); }
.totals dt { text-align: right; } .totals dd { margin: 0; text-align: right; min-width: 90px; }

.checkout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; }
@media (max-width: 860px) { .checkout { grid-template-columns: 1fr; } }
.payframe { width: 100%; max-width: 420px; height: 236px; border: 1px solid var(--line); border-radius: var(--radius); }
.panel { border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; align-self: start; }
.panel h2 { margin-top: 0; }

footer.site { border-top: 1px solid var(--line); padding: 24px 0 40px; font-size: 14px; color: var(--muted); }
footer.site .wrap { display: flex; gap: 16px; justify-content: space-between; flex-wrap: wrap; }
`;

/** The card-field iframe's own tiny stylesheet (inlined into /pay/frame). */
export const PAY_CSS = `
body { margin: 0; padding: 16px; font: 15px/1.4 "Helvetica Neue", Arial, sans-serif; color: #1a1f36; background: #fff; }
label { display: block; font-size: 13px; color: #4f566b; margin: 0 0 4px; }
input { font: inherit; width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid #cfd7df; border-radius: 6px; margin: 0 0 12px; }
input:focus { outline: 2px solid #635bff; outline-offset: 0; border-color: #635bff; }
.row { display: flex; gap: 12px; } .row > div { flex: 1; }
.err { color: #df1b41; font-size: 14px; min-height: 20px; margin: 0; }
.brand { font-size: 12px; color: #8792a2; margin-top: 2px; }
`;
