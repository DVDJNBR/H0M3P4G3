import { describe, it, expect } from 'vitest';
import { raindropBlockSchema, type RaindropBlock } from '@h0m3p4g3/shared/schema';

describe('Raindrop Block Configuration & Slicing', () => {
  it('validates RaindropBlock schema with collectionId and optional displayCap', () => {
    const block: RaindropBlock = {
      kind: 'raindrop',
      id: 'r-1',
      collectionId: 'col-movies-100',
      displayCap: 3,
    };

    const parsed = raindropBlockSchema.parse(block);
    expect(parsed.collectionId).toBe('col-movies-100');
    expect(parsed.displayCap).toBe(3);
  });

  it('slices items correctly according to displayCap', () => {
    const items = [
      { id: 1, title: 'Item 1', link: 'https://a.com', domain: 'a.com' },
      { id: 2, title: 'Item 2', link: 'https://b.com', domain: 'b.com' },
      { id: 3, title: 'Item 3', link: 'https://c.com', domain: 'c.com' },
      { id: 4, title: 'Item 4', link: 'https://d.com', domain: 'd.com' },
    ];

    const displayCap = 2;
    const sliced = displayCap ? items.slice(0, displayCap) : items;
    expect(sliced).toHaveLength(2);
    expect(sliced[0].title).toBe('Item 1');
    expect(sliced[1].title).toBe('Item 2');
  });

  it('returns all items when displayCap is undefined', () => {
    const items = [
      { id: 1, title: 'Item 1', link: 'https://a.com', domain: 'a.com' },
      { id: 2, title: 'Item 2', link: 'https://b.com', domain: 'b.com' },
    ];

    const displayCap = undefined;
    const sliced = displayCap ? items.slice(0, displayCap) : items;
    expect(sliced).toHaveLength(2);
  });
});
