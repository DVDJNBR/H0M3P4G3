// AD-2: this module is the SOLE owner of the filesystem under DATA_DIR.
// Every write is atomic: write a temp file in the same directory, then
// rename(2) over the target — a crash mid-write can never leave invalid
// JSON at the canonical path. On first boot with an empty data dir a valid
// default layout (3 empty columns) is seeded.
import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { layoutSchema, type Layout } from '@h0m3p4g3/shared/schema';

const LAYOUT_FILE = 'layout.json';
const TMP_SUFFIX = '.tmp';

/** Typed error for any storage failure (unreadable, invalid JSON, schema-invalid). */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export interface LayoutStore {
  /** Read + schema-validate the persisted layout. Throws StorageError on corruption. */
  readLayout(): Promise<Layout>;
  /** Validate then atomically persist the layout (tmp file + rename). */
  writeLayout(layout: Layout): Promise<void>;
}

/** Default document seeded on first boot: 3 empty Columns, no Blocks. */
function defaultLayout(): Layout {
  return {
    columns: Array.from({ length: 3 }, () => ({
      id: nanoid(),
      title: '',
      blocks: [],
    })),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createStore(dataDir: string): LayoutStore {
  const layoutPath = join(dataDir, LAYOUT_FILE);

  return {
    async readLayout(): Promise<Layout> {
      let raw: string;
      try {
        raw = await readFile(layoutPath, 'utf8');
      } catch (err) {
        throw new StorageError(`cannot read ${layoutPath}`, { cause: err });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new StorageError(`${layoutPath} contains invalid JSON`, { cause: err });
      }

      const result = layoutSchema.safeParse(parsed);
      if (!result.success) {
        throw new StorageError(`${layoutPath} failed layout schema validation`, {
          cause: result.error,
        });
      }
      return result.data;
    },

    async writeLayout(layout: Layout): Promise<void> {
      const result = layoutSchema.safeParse(layout);
      if (!result.success) {
        throw new StorageError('refusing to persist a schema-invalid layout', {
          cause: result.error,
        });
      }
      // Unique temp name in the SAME directory so rename() is atomic
      // (same filesystem) and concurrent writes never share a temp file.
      const tmpPath = `${layoutPath}.${nanoid(8)}${TMP_SUFFIX}`;
      await writeFile(tmpPath, JSON.stringify(result.data, null, 2), 'utf8');
      await rename(tmpPath, layoutPath);
    },
  };
}

/**
 * Boot-time entry point: ensure DATA_DIR exists, clean stale temp files left
 * by an interrupted write, and seed the default layout if none is persisted.
 */
export async function initLayoutStore(dataDir: string): Promise<LayoutStore> {
  await mkdir(dataDir, { recursive: true });

  // A crash between writeFile and rename leaves `layout.json.<id>.tmp`
  // behind; it is never read as data — remove it. A cleanup failure (e.g.
  // permission error) must not block boot, but it must be operator-visible.
  const entries = await readdir(dataDir);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(`${LAYOUT_FILE}.`) && name.endsWith(TMP_SUFFIX))
      .map((name) => {
        const tmpPath = join(dataDir, name);
        return unlink(tmpPath).catch((err) => {
          console.error(`[storage] failed to remove stale temp file ${tmpPath}`, err);
        });
      }),
  );

  const store = createStore(dataDir);
  const layoutPath = join(dataDir, LAYOUT_FILE);
  if (!(await fileExists(layoutPath))) {
    await store.writeLayout(defaultLayout());
    console.log(`[storage] seeded default layout at ${layoutPath}`);
  }
  return store;
}
