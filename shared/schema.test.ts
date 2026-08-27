// AD-10: the layout document's zod schemas are defined once in schema.ts.
// These tests exercise them directly — server-side storage/route tests only
// cover them indirectly via the storage adapter and HTTP layer.
import { describe, expect, it } from 'vitest';
import { blockSchema, layoutSchema, linkSchema, type Layout } from './schema.js';

describe('layoutSchema', () => {
  it('parses a valid minimal Layout', () => {
    const minimal: Layout = {
      columns: [
        { id: 'col-1', blocks: [] },
        { id: 'col-2', blocks: [] },
      ],
    };
    expect(layoutSchema.parse(minimal)).toEqual(minimal);
  });

  it('parses a Layout with both links and raindrop blocks', () => {
    const layout: Layout = {
      columns: [
        {
          id: 'col-1',
          blocks: [
            {
              kind: 'links',
              id: 'blk-1',
              title: 'Tools',
              links: [{ id: 'lnk-1', title: 'GitHub', url: 'https://github.com' }],
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
    expect(layoutSchema.parse(layout)).toEqual(layout);
  });
});

describe('blockSchema', () => {
  it('parses a valid raindrop block with collectionId and displayCap', () => {
    const valid = {
      kind: 'raindrop' as const,
      id: 'rd-1',
      title: 'Medium Reads',
      collectionId: 'col-999',
      displayCap: 5,
    };
    expect(blockSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a raindrop block with a non-positive displayCap', () => {
    expect(() =>
      blockSchema.parse({
        kind: 'raindrop',
        id: 'rd-1',
        title: 'Medium Reads',
        collectionId: 'col-999',
        displayCap: 0,
      }),
    ).toThrow();
  });

  it('rejects a Block with an unrecognized kind', () => {
    expect(() =>
      blockSchema.parse({ kind: 'bogus', id: 'b1', title: 'Broken' }),
    ).toThrow();
  });
});

describe('linkSchema', () => {
  it('rejects a Link missing url', () => {
    expect(() => linkSchema.parse({ id: 'l1', title: 'No URL' })).toThrow();
  });

  it('rejects a javascript: scheme on url', () => {
    expect(() =>
      linkSchema.parse({ id: 'l1', title: 'XSS', url: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('rejects a javascript: scheme on faviconOverride', () => {
    expect(() =>
      linkSchema.parse({
        id: 'l1',
        title: 'XSS favicon',
        url: 'https://example.com',
        faviconOverride: 'javascript:alert(1)',
      }),
    ).toThrow();
  });

  it('accepts an https faviconOverride', () => {
    const link = {
      id: 'l1',
      title: 'Custom favicon',
      url: 'https://example.com',
      faviconOverride: 'https://example.com/favicon.ico',
    };
    expect(linkSchema.parse(link)).toEqual(link);
  });
});
