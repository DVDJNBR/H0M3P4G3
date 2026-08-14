import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutSchema, type Layout } from '@h0m3p4g3/shared/schema';
import { initLayoutStore, StorageError } from './layout-store.js';

// Module namespace objects are non-configurable under Vitest's native ESM
// (vi.spyOn can't redefine `unlink` in place), so wrap it in a vi.fn at mock
// time — real behavior by default, overridable per-test.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, unlink: vi.fn(actual.unlink) };
});

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-store-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dataDir, { recursive: true, force: true });
});

function sampleLayout(): Layout {
  return {
    columns: [
      {
        id: 'col-1',
        title: 'Dev',
        blocks: [
          {
            kind: 'links',
            id: 'blk-1',
            title: 'Tools',
            links: [
              { id: 'lnk-1', title: 'GitHub', url: 'https://github.com' },
              {
                id: 'lnk-2',
                title: 'Docs',
                url: 'https://example.com/docs',
                faviconOverride: 'https://example.com/custom.png',
              },
            ],
          },
          {
            kind: 'raindrop',
            id: 'blk-2',
            title: 'Reading',
            collectionId: '12345',
            displayCap: 10,
          },
        ],
      },
    ],
  };
}

describe('initLayoutStore', () => {
  it('creates a missing data dir and seeds 3 empty columns on first boot', async () => {
    const nestedDir = join(dataDir, 'nested', 'data');
    const store = await initLayoutStore(nestedDir);

    const onDisk = JSON.parse(await readFile(join(nestedDir, 'layout.json'), 'utf8'));
    expect(() => layoutSchema.parse(onDisk)).not.toThrow();
    expect(onDisk.columns).toHaveLength(3);
    for (const column of onDisk.columns) {
      expect(column.blocks).toEqual([]);
      expect(column.title).toBe('');
      expect(typeof column.id).toBe('string');
      expect(column.id.length).toBeGreaterThan(0);
    }

    expect(await store.readLayout()).toEqual(onDisk);
  });

  it('does not overwrite an existing layout.json', async () => {
    const first = await initLayoutStore(dataDir);
    await first.writeLayout(sampleLayout());

    const second = await initLayoutStore(dataDir);
    expect(await second.readLayout()).toEqual(sampleLayout());
  });

  it('cleans stale temp files left by an interrupted write', async () => {
    await initLayoutStore(dataDir);
    await writeFile(join(dataDir, 'layout.json.abc123.tmp'), '{"columns": [', 'utf8');

    const store = await initLayoutStore(dataDir);
    const entries = await readdir(dataDir);
    expect(entries).toEqual(['layout.json']);
    // The last successfully renamed document is intact.
    expect(layoutSchema.parse(await store.readLayout()).columns).toHaveLength(3);
  });

  it('logs a [storage] error when stale temp cleanup fails, but boot still succeeds', async () => {
    await initLayoutStore(dataDir);
    await writeFile(join(dataDir, 'layout.json.stale1.tmp'), 'x', 'utf8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(unlink).mockRejectedValueOnce(new Error('EACCES: permission denied'));

    const store = await initLayoutStore(dataDir);

    expect(vi.mocked(unlink)).toHaveBeenCalled();
    const cleanupLog = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes('[storage]'),
    );
    expect(cleanupLog).toBeDefined();
    expect(String(cleanupLog?.[0])).toContain('layout.json.stale1.tmp');

    // Cleanup failure did not block boot — the seeded document still reads back fine.
    expect(layoutSchema.parse(await store.readLayout()).columns).toHaveLength(3);
  });
});

describe('readLayout / writeLayout roundtrip', () => {
  it('returns exactly what was written', async () => {
    const store = await initLayoutStore(dataDir);
    await store.writeLayout(sampleLayout());
    expect(await store.readLayout()).toEqual(sampleLayout());
  });

  it('leaves no temp file behind after a successful write', async () => {
    const store = await initLayoutStore(dataDir);
    await store.writeLayout(sampleLayout());
    expect(await readdir(dataDir)).toEqual(['layout.json']);
  });
});

describe('corruption handling', () => {
  it('throws StorageError on invalid JSON', async () => {
    const store = await initLayoutStore(dataDir);
    await writeFile(join(dataDir, 'layout.json'), 'not json {{{', 'utf8');
    await expect(store.readLayout()).rejects.toBeInstanceOf(StorageError);
  });

  it('throws StorageError on valid JSON that fails the schema', async () => {
    const store = await initLayoutStore(dataDir);
    await writeFile(
      join(dataDir, 'layout.json'),
      JSON.stringify({ columns: [{ id: 'x', title: 'y', blocks: [{ kind: 'bogus' }] }] }),
      'utf8',
    );
    await expect(store.readLayout()).rejects.toBeInstanceOf(StorageError);
  });

  it('refuses to write a schema-invalid layout and keeps the previous document', async () => {
    const store = await initLayoutStore(dataDir);
    await store.writeLayout(sampleLayout());

    const invalid = { columns: [{ nope: true }] } as unknown as Layout;
    await expect(store.writeLayout(invalid)).rejects.toBeInstanceOf(StorageError);
    expect(await store.readLayout()).toEqual(sampleLayout());
  });
});

describe('crash-mid-write atomicity', () => {
  it('a leftover temp file does not corrupt reads — previous doc stays intact', async () => {
    const store = await initLayoutStore(dataDir);
    await store.writeLayout(sampleLayout());

    // Simulate an interrupted write: temp file written, rename never happened.
    await writeFile(
      join(dataDir, 'layout.json.deadbee.tmp'),
      '{"columns": [{"id": "half-writ',
      'utf8',
    );

    expect(await store.readLayout()).toEqual(sampleLayout());
  });
});
