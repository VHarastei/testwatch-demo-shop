/** Client scripts, served as same-origin files so the CSP needs no 'unsafe-inline'. */

/** Parent page: asks the card iframe for a token, then submits the order form. */
export const CHECKOUT_JS = `
(() => {
  const form = document.getElementById('checkout');
  const frame = document.getElementById('payframe');
  const token = document.getElementById('pay_token');
  const button = document.getElementById('place-order');
  if (!form || !frame || !token || !button) return;
  form.addEventListener('submit', (e) => {
    if (token.value) return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    button.textContent = 'Processing…';
    frame.contentWindow.postMessage({ type: 'fm-pay:submit' }, location.origin);
  });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'fm-pay:result') return;
    if (e.data.ok) {
      token.value = e.data.token;
      form.submit();
    } else {
      button.disabled = false;
      button.textContent = button.dataset.label;
    }
  });
})();
`;

/** Inside the iframe: tokenizes the card and reports back to the parent. */
export const PAY_JS = `
(() => {
  const err = document.getElementById('card-errors');
  const amount = Number(document.body.dataset.amount);
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'fm-pay:submit') return;
    err.textContent = '';
    let result;
    try {
      const res = await fetch('/pay/tokenize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          number: document.getElementById('cardnumber').value,
          expiry: document.getElementById('exp-date').value,
          cvc: document.getElementById('cvc').value,
          amountCents: amount,
        }),
      });
      result = await res.json();
    } catch {
      result = { ok: false, error: 'Network error. Try again.' };
    }
    if (!result.ok) err.textContent = result.error;
    parent.postMessage({ type: 'fm-pay:result', ...result }, location.origin);
  });
})();
`;

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1e2f27"/><path d="M6 22c4-6 8-1 12-6s6-6 8-4" fill="none" stroke="#f1f4f1" stroke-width="2" stroke-linecap="round"/><path d="M6 15c3-4 6-1 9-4s5-4 7-3" fill="none" stroke="#c84a17" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="23" r="2" fill="#f1f4f1"/></svg>`;
