# Enclose's website

The landing page for [enclose.dev](https://enclose.dev), built with
[Modulato](https://modulato.org).

```sh
npm install
npm run dev        # SSR + HMR on https://marketing.localhost (portless)
npm run check      # conventions + TypeScript
npm run build      # production build (VERCEL=1 for .vercel/output)
```

`npm run dev` serves a stable, port-free URL via
[portless](https://www.npmjs.com/package/portless) (requires Node >= 24; the
first run asks to trust a local certificate). The domain name lives in
`portless.json`. No Node 24, or a CI/non-TTY environment? `npm run dev:plain`
starts the plain Vite server on a port.

The type is Inter Display: Inter's variable font, loaded in `app.tsx` and held
at its display optical size in `styles/global.scss`. The styles built on it are
in `tokens/type.ts`, and the colors in `tokens/color.ts`.

Open the ✦ Tweak button (dev) to change the type, the colors and every
animation number live — Save writes back into the token files.

The full framework reference is in **MODULATO.md**. If you work with Claude
or another agent, it reads CLAUDE.md and MODULATO.md automatically.
