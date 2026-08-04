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
