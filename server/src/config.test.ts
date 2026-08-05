import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

// Realistic-shaped values: PASSWORD_HASH must be a well-formed bcrypt hash
// and TOTP_SECRET must Base32-decode to >=16 bytes now that loadConfig
// validates format, not just presence (see the malformed-value tests
// below). This hash is bcryptjs's hash of the literal string "hash" at a
// low cost factor — the value itself is never checked against anything,
// only its shape.
const validEnv = {
  PASSWORD_HASH: '$2b$04$FwYPHJIBji5/wtXPyUsRqOgai.4NihEmT49konYjHNhVjI8OjwMg6',
  TOTP_SECRET: '2VUUIZYIXPJELMXFIZJZ4Y767RFCUB5H',
  SESSION_SECRET: 'session',
  RAINDROP_TOKEN: 'token',
};

describe('loadConfig', () => {
  it('parses a fully populated env with defaults for PORT and DATA_DIR', () => {
    const config = loadConfig({ ...validEnv });
    expect(config).toEqual({
      passwordHash: validEnv.PASSWORD_HASH,
      totpSecret: validEnv.TOTP_SECRET,
      sessionSecret: 'session',
      raindropToken: 'token',
      port: 3000,
      dataDir: './data',
    });
  });

  it('honours explicit PORT and DATA_DIR', () => {
    const config = loadConfig({ ...validEnv, PORT: '4321', DATA_DIR: '/data' });
    expect(config.port).toBe(4321);
    expect(config.dataDir).toBe('/data');
  });

  it.each([
    'PASSWORD_HASH',
    'TOTP_SECRET',
    'SESSION_SECRET',
    'RAINDROP_TOKEN',
  ] as const)('fails fast naming %s when it is unset', (name) => {
    const env: Record<string, string> = { ...validEnv };
    delete env[name];
    expect(() => loadConfig(env)).toThrowError(new RegExp(name));
  });

  it('fails fast naming SESSION_SECRET when it is empty', () => {
    expect(() => loadConfig({ ...validEnv, SESSION_SECRET: '' })).toThrowError(
      /SESSION_SECRET/,
    );
  });

  it('fails fast naming PASSWORD_HASH when it is whitespace-only', () => {
    expect(() => loadConfig({ ...validEnv, PASSWORD_HASH: '   ' })).toThrowError(
      /PASSWORD_HASH/,
    );
  });

  it('names every missing variable at once', () => {
    expect(() => loadConfig({})).toThrowError(
      /PASSWORD_HASH, TOTP_SECRET, SESSION_SECRET, RAINDROP_TOKEN/,
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrowError(/PORT/);
  });

  it('fails fast naming PASSWORD_HASH when it is not a well-formed bcrypt hash', () => {
    expect(() => loadConfig({ ...validEnv, PASSWORD_HASH: 'dev-password-hash' })).toThrowError(
      /PASSWORD_HASH/,
    );
  });

  it('fails fast naming PASSWORD_HASH when it looks like bcrypt but is truncated', () => {
    expect(() =>
      loadConfig({ ...validEnv, PASSWORD_HASH: '$2b$10$tooShortToBeARealHash' }),
    ).toThrowError(/PASSWORD_HASH/);
  });

  it('fails fast naming TOTP_SECRET when it decodes to fewer than 16 bytes', () => {
    // 'JBSWY3DPEHPK3PXP' is the classic otplib/speakeasy sample secret —
    // valid Base32, but only 10 bytes decoded, below otplib's minimum.
    expect(() => loadConfig({ ...validEnv, TOTP_SECRET: 'JBSWY3DPEHPK3PXP' })).toThrowError(
      /TOTP_SECRET/,
    );
  });

  it('fails fast naming TOTP_SECRET when it contains non-Base32 characters', () => {
    expect(() =>
      loadConfig({ ...validEnv, TOTP_SECRET: 'not-valid-base32-at-all-01!!' }),
    ).toThrowError(/TOTP_SECRET/);
  });

  it('names every malformed variable at once', () => {
    expect(() =>
      loadConfig({ ...validEnv, PASSWORD_HASH: 'nope', TOTP_SECRET: 'short' }),
    ).toThrowError(/PASSWORD_HASH.*TOTP_SECRET/s);
  });
});
