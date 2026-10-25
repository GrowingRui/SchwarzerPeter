# CLAUDE.md: Schwarzer Peter

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Review Before Publishing
- After any change, show it on localhost (`http://localhost:3000`) first and tell the user what to check.
- **Only push to GitHub or deploy after the user says yes.** Pushing to `main` deploys to https://schwarzerpeter.vercel.app. Branch pushes create Vercel preview deploys, so they need a yes too.

## Project Layout
- npm workspaces monorepo. Run `npm install` at the root.
- `apps/web`: website and game screens. Vite, Tailwind v4 (`src/styles.css` holds the `@theme` brand tokens and the shared component styles), ES module scripts in `src/`, static files in `public/`. Pages are listed in `vite.config.js` (`build.rollupOptions.input`).
- `apps/web/src/cards.js`: the SVG card art for the Alpine deck.
- `apps/web/src/i18n.ts`: all English and German text. New text on any page needs both an English and a German entry (`data-i18n` on static pages, `t()` in the game). German uses "du" and standard spelling with ß.
- `packages/engine` (`@sp/engine`): the game rules as pure TypeScript functions with a seeded RNG, shared by the web app, bots and the game server. `@sp/engine/protocol` defines the browser/server messages. Every rule change needs a test in `packages/engine/test`.
- `apps/server` (`@sp/server`): online rooms on Cloudflare Workers + Durable Objects. Room logic lives in `src/room.ts` (tested in Node), the Durable Object in `src/worker.ts`.
- `brand_assets/`: logo source and `brand-guidelines.md`. The web copy of the logo is `apps/web/public/brand_assets/logo-web.jpg`.
- Hosting: Vercel for the website (`vercel.json` builds `apps/web`). Online rooms run on the Cloudflare Workers + Durable Objects free plan (free plans only).

## Commands
- `npm run dev` or `node serve.mjs`: Vite dev server at `http://localhost:3000`.
- `npm run dev:server`: local game server at `http://localhost:8787`, needed for online rooms. Test with two players from a normal and a private window.
- `npm test`: engine tests. `npm run typecheck`: TypeScript. `npm run build`: production build in `apps/web/dist`.
- CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every push.

## Local Server
- **Always serve on localhost**. Never screenshot a `file:///` URL.
- Start the dev server in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- `screenshot.mjs` uses the project's `puppeteer-core` dev dependency with the installed Chrome or Edge (set `CHROME_PATH` to use another browser).
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten, git-ignored).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` saves as `screenshot-N-label.png`. An optional third argument sets the viewport width.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px".
- Check spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows and image sizing.
- Do at least 2 screenshot-and-fix rounds for visual work.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).

## Output Defaults
- Pages are HTML files in `apps/web` styled with Tailwind utility classes. Brand colors come from the `@theme` tokens (`kohle`, `russ`, `pergament`, `glut`, `messing`); never hard-code a new color.
- Shared component styles go in `apps/web/src/styles.css` under `@layer components`, so utilities can override them.
- Game screens (Phase 2 onwards) will use React.
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive.

## Brand Assets
- Always check `brand_assets/` and `brand_assets/brand-guidelines.md` before designing.
- Use the real logo and the defined palette. Do not use placeholders where real assets exist, and do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Use the brand tokens.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Gloock for headings, Figtree for body. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-linear-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens, not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base, elevated, floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design. Match it.
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
