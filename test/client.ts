import { env } from 'cloudflare:workers';
import worker from '../src/index.js';

const ORIGIN = 'https://shop.test';

/** A tiny browser: keeps the session cookie between calls, never follows redirects. */
export function browser(overrides: Partial<Env> = {}) {
  let cookie = '';
  const e = { ...env, ...overrides } as Env;
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', cookie);
    const res = await worker.fetch(
      new Request(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' }) as Request<
        unknown,
        IncomingRequestCfProperties
      >,
      e,
    );
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0] ?? '';
    return res;
  }
  return {
    get: (path: string) => request(path),
    post: (path: string, fields: Record<string, string>) =>
      request(path, { method: 'POST', body: new URLSearchParams(fields) }),
    json: (path: string, body: unknown) =>
      request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    request,
    get cookie() {
      return cookie;
    },
  };
}
