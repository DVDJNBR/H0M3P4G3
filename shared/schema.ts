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
  // A second URL (e.g. the GitHub repo for a deployed site) rendered as a
  // small icon appended after the primary one -- its own separate link.
  secondaryUrl: httpUrlSchema.optional(),
  // Replaces the favicon with a live up/degraded/down status dot (checked
  // server-side via /api/link-status -- CORS makes a client-side fetch
  // unreliable for arbitrary third-party origins).
  showStatusDot: z.boolean().optional(),
});

export const linksBlockSchema = z.object({
  kind: z.literal('links'),
  id: z.string().min(1),
  links: z.array(linkSchema),
});

export const raindropBlockSchema = z.object({
  kind: z.literal('raindrop'),
  id: z.string().min(1),
  collectionId: z.string(),
  displayCap: z.number().int().positive().optional(),
});

// Personal custom-widget escape hatch: arbitrary HTML+JS, stored as data
// (not hardcoded in the app) and rendered in a sandboxed iframe. Trust
// model: single-user personal site, content only the owner ever writes --
// same tradeoff already made for the app's own auth/session design.
export const htmlBlockSchema = z.object({
  kind: z.literal('html'),
  id: z.string().min(1),
  content: z.string(),
});

// Read-only view of the owner's active Todoist tasks (no date | overdue |
// today, mirroring TodoBar's own filter). Single personal account, same
// token-in-env-no-per-block-config shape as the Raindrop block.
export const todoistBlockSchema = z.object({
  kind: z.literal('todoist'),
  id: z.string().min(1),
});

// Discriminated on `kind` — the Epic 2/3 forward contract.
export const blockSchema = z.discriminatedUnion('kind', [
  linksBlockSchema,
  raindropBlockSchema,
  htmlBlockSchema,
  todoistBlockSchema,
]);

export const columnSchema = z.object({
  id: z.string().min(1),
  blocks: z.array(blockSchema),
});

export const layoutSchema = z.object({
  columns: z.array(columnSchema),
});

export type Link = z.infer<typeof linkSchema>;
export type LinksBlock = z.infer<typeof linksBlockSchema>;
export type RaindropBlock = z.infer<typeof raindropBlockSchema>;
export type HtmlBlock = z.infer<typeof htmlBlockSchema>;
export type TodoistBlock = z.infer<typeof todoistBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Layout = z.infer<typeof layoutSchema>;
