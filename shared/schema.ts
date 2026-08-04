// AD-10: the layout document (Page -> ordered Columns -> ordered Blocks of
// kind `links` | `raindrop` -> ordered Links) is defined ONCE here as zod
// schemas. The server validates with these schemas and the web app imports
// the inferred types — no second hand-written type for these entities
// anywhere. IDs are nanoid strings, generated server-side (AD-7).
import { z } from 'zod';

// http/https only — links and favicons are stored and later rendered as
// href/src (story 1.4, Epic 2); an unrestricted scheme (e.g. `javascript:`,
// `data:`) would be a stored-XSS vector, so the single source of truth
// (AD-10) rejects it at the schema level.
const httpUrlSchema = z.url({ protocol: /^https?$/ });

export const linkSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  url: httpUrlSchema,
  faviconOverride: httpUrlSchema.optional(),
});

export const linksBlockSchema = z.object({
  kind: z.literal('links'),
  id: z.string().min(1),
  title: z.string(),
  links: z.array(linkSchema),
});

export const raindropBlockSchema = z.object({
  kind: z.literal('raindrop'),
  id: z.string().min(1),
  title: z.string(),
  collectionId: z.string(),
  displayCap: z.number().int().positive().optional(),
});

// Discriminated on `kind` — the Epic 2/3 forward contract.
export const blockSchema = z.discriminatedUnion('kind', [
  linksBlockSchema,
  raindropBlockSchema,
]);

export const columnSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  blocks: z.array(blockSchema),
});

export const layoutSchema = z.object({
  columns: z.array(columnSchema),
});

export type Link = z.infer<typeof linkSchema>;
export type LinksBlock = z.infer<typeof linksBlockSchema>;
export type RaindropBlock = z.infer<typeof raindropBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Layout = z.infer<typeof layoutSchema>;
