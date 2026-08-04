// AD-10: the layout document (Page -> ordered Columns -> ordered Blocks of
// kind `links` | `raindrop` -> ordered Links) is defined ONCE here as zod
// schemas. The server validates with these schemas and the web app imports
// the inferred types — no second hand-written type for these entities
// anywhere. Story 1.2 fills this module; until then it intentionally
// exports nothing.
export {};
