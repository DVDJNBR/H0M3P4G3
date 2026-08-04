import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const validEnv = {
  PASSWORD_HASH: 'hash',
  TOTP_SECRET: 'totp',
  SESSION_SECRET: 'session',
  RAINDROP_TOKEN: 'token',
};

describe('loadConfig', () => {
  it('parses a fully populated env with defaults for PORT and DATA_DIR', () => {
    const config = loadConfig({ ...validEnv });
    expect(config).toEqual({
      passwordHash: 'hash',
      totpSecret: 'totp',
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
});
