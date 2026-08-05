// AD-6: secrets come from the environment only, parsed fail-fast at boot.
// Any missing required variable throws an error naming it; index.ts turns
// that into a non-zero exit.

export interface Config {
  passwordHash: string;
  totpSecret: string;
  sessionSecret: string;
  raindropToken: string;
  port: number;
  dataDir: string;
}

const REQUIRED_VARS = [
  'PASSWORD_HASH',
  'TOTP_SECRET',
  'SESSION_SECRET',
  'RAINDROP_TOKEN',
] as const;

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_DIR = './data';

// A well-formed bcryptjs hash: $2a$/$2b$/$2y$, a 2-digit cost, then 53
// characters of salt+digest in bcrypt's own base64 alphabet.
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// otplib's TOTP guardrail rejects any secret that Base32-decodes to fewer
// than 16 bytes (128 bits) -- mirrored here so a too-short TOTP_SECRET
// fails fast at boot (AD-6) instead of silently surfacing as an ordinary
// "wrong credentials" 401 the first time someone tries to log in.
const TOTP_SECRET_MIN_BYTES = 16;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Byte length a Base32 string decodes to (5 bits/char), or null if it isn't valid Base32. */
function base32DecodedByteLength(value: string): number | null {
  const cleaned = value.trim().toUpperCase().replace(/=+$/, '');
  if (cleaned.length === 0) return null;
  for (const ch of cleaned) {
    if (!BASE32_ALPHABET.includes(ch)) return null;
  }
  return Math.floor((cleaned.length * 5) / 8);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED_VARS.filter((name) => {
    const value = env[name];
    // A whitespace-only value counts as missing — it would boot with a
    // blank-for-practical-purposes secret.
    return value === undefined || value.trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  const malformed: string[] = [];

  const passwordHash = (env.PASSWORD_HASH as string).trim();
  if (!BCRYPT_HASH_PATTERN.test(passwordHash)) {
    malformed.push('PASSWORD_HASH (must be a bcrypt hash, e.g. $2b$10$...)');
  }

  const totpSecret = (env.TOTP_SECRET as string).trim();
  const totpSecretBytes = base32DecodedByteLength(totpSecret);
  if (totpSecretBytes === null || totpSecretBytes < TOTP_SECRET_MIN_BYTES) {
    malformed.push(
      `TOTP_SECRET (must be a Base32 string decoding to at least ${TOTP_SECRET_MIN_BYTES} bytes)`,
    );
  }

  if (malformed.length > 0) {
    throw new Error(`Malformed environment variable(s): ${malformed.join(', ')}`);
  }

  let port = DEFAULT_PORT;
  if (env.PORT !== undefined && env.PORT !== '') {
    port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT value: ${env.PORT}`);
    }
  }

  return {
    passwordHash: env.PASSWORD_HASH as string,
    totpSecret: env.TOTP_SECRET as string,
    sessionSecret: env.SESSION_SECRET as string,
    raindropToken: env.RAINDROP_TOKEN as string,
    port,
    dataDir: env.DATA_DIR !== undefined && env.DATA_DIR !== '' ? env.DATA_DIR : DEFAULT_DATA_DIR,
  };
}
