import { colors } from 'modulato'

/**
 * The palette — every color in the project, as DATA.
 *
 * Each key becomes a CSS custom property on `:root`: `accent` is
 * `--accent`, read anywhere as `var(--accent)`. Modulato inlines the whole
 * block into every SSR response, so the first paint is already in the right
 * colors.
 *
 * Same argument as `type.ts`: a color is a value somebody wants to change
 * while looking at the page, and a stylesheet is not something the Tweak
 * overlay can safely author. As data it is editable live, saved back with an
 * AST-preserving edit — and a NEW color can be added from the page itself,
 * with the + button in the overlay's Colors tab.
 *
 * Renaming a color in the overlay also rewrites every `var()` that reads it,
 * across the project. Renaming it BY HAND here does not — so if you edit a
 * name in this file, search for the old one.
 *
 * Theme overrides stay in CSS. A `.is-dark { --bg: … }` block redefines these
 * same variables for a surface, which is a selector question rather than a
 * palette one, and it works by out-specifying the `:root` this generates.
 */
export default colors({
  bg: '#ffffff',
  fg: '#0a0a0a',
  muted: '#737373',
  rule: '#e5e5e5',
  // The app's window, rebuilt on the page, in the app's dark theme.
  'app-view': '#171717',
  'app-thread': '#0a0a0a',
  'app-raised': '#262626',
  'app-fg': '#fafafa',
  'app-muted': '#a1a1a1',
  'app-primary': '#e5e5e5',
  'app-attention': '#f0b64a',
  'app-paper': '#f5f6ec',
  // The model's three axes. What a project's own tools are drawn in is the
  // blue of Z.
  'axis-x': '#ff0033',
  'axis-y': '#74d908',
  'axis-z': '#0f73ff',
})
