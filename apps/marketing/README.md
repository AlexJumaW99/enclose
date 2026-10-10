# Enclose's website

The landing page for [enclose.dev](https://enclose.dev), built with
[Modulato](https://modulato.org).

```sh
npm install
npm run dev        # SSR + HMR on https://enclose.localhost (portless)
npm run check      # conventions + TypeScript
npm run build      # production build (VERCEL=1 for .vercel/output)
```

`npm run dev` serves a stable, port-free URL via
[portless](https://www.npmjs.com/package/portless) (requires Node >= 24; the
first run asks to trust a local certificate). The domain name lives in
`portless.json`. No Node 24, or a CI/non-TTY environment? `npm run dev:plain`
starts the plain Vite server on a port.

## What is where

```
pages/home/        the page: what it says, and the scroll that moves the window
  tour.ts          the scroll, from stop to stop, and what goes on at each
  motion.ts        where the window is at each stop (tokens, editable in ✦ Tweak)
pages/terms/       the terms
pages/privacy/     the privacy page
components/app/    the app's window, rebuilt out of HTML, and its 3D view
  data.ts          the projects, the conversation and the tools it is filled with
  view.ts          the model, drawn with three.js as the app draws one
shell/             the header, its mark (the brand's, drawn in code) and the footer
tokens/            the type and the colors
public/model/      the robot arm of the app's examples, packed small for the web
public/blueprint/  that arm's blueprint sheets, drawn by the app's own code
scripts/           what makes those two
```

The window on the page is not a picture of the app. It is built again here, to
the app's own sizes and colors, so that the page can say what is in it. When the
app's window changes, `components/app` is what to change to match.

## The model and its drawings

Both are made from [`examples/arm`](../../examples/arm), and are committed, so the
site builds without them being made again:

```sh
npm run model        # public/model: the arm's meshes and edges, simplified
npm run blueprints   # public/blueprint: its sheets, as the app would save them
```

`npm run blueprints` runs the desktop app's own drawing code, so `apps/desktop`
has to have its packages installed.

## Type

The type is Inter Display: Inter's variable font, loaded in `app.tsx` and held
at its display optical size in `styles/global.scss`. The window is set in Inter
as the app has it. The styles built on both are in `tokens/type.ts`, and the
colors in `tokens/color.ts`.

Open the ✦ Tweak button (dev) to change the type, the colors and every
animation number live — Save writes back into the token files.

The full framework reference is in **MODULATO.md**. If you work with Claude
or another agent, it reads CLAUDE.md and MODULATO.md automatically.
