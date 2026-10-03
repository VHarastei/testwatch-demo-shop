import { safeEqual } from './crypto.js';

export interface Account {
  username: string;
  password: string;
  displayName: string;
  /** Base32 TOTP secret; set → the account needs a 6-digit code after the password. */
  totpSecret?: string;
}

/** Public demo accounts — published in the README on purpose. Never reuse these anywhere. */
export const ACCOUNTS: Account[] = [
  { username: 'shopper', password: 'fieldmark-demo', displayName: 'Robin Shopper' },
  {
    username: 'shopper-2fa',
    password: 'fieldmark-demo',
    displayName: 'Sam Twofactor',
    totpSecret: 'GZ4FORKTNBVFGQTFJJGEIRDOKY',
  },
];

export function checkPassword(username: string, password: string): Account | null {
  const account = ACCOUNTS.find((a) => a.username === username.trim().toLowerCase());
  // Compare even when the user is unknown so timing doesn't reveal which usernames exist.
  const ok = safeEqual(password, account?.password ?? 'x'.repeat(password.length + 1));
  return account && ok ? account : null;
}

export const accountOf = (username: string | undefined): Account | undefined =>
  ACCOUNTS.find((a) => a.username === username);
