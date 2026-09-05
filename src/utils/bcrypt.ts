import bcrypt from 'bcryptjs';

if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
  bcrypt.setRandomFallback((len: number) => {
    const buf = new Uint8Array(len);
    window.crypto.getRandomValues(buf);
    return Array.from(buf);
  });
}

/**
 * Generates the dynamic bcrypt hash for Gorig-OM auth within the 10-second time window.
 *
 * Algorithm:
 * 1. window = Math.floor(Date.now() / 10000)
 * 2. localPwd = `${window}${omKey}`
 * 3. return bcrypt.hashSync(localPwd, 10)
 */
export function generateOmKeyHash(omKey: string): string {
  const window = Math.floor(Date.now() / 10000);
  const plainText = `${window}${omKey.trim()}`;
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

