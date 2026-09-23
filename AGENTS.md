<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Machine constraints (owner hardware)

The owner is on a slow laptop with small RAM and a weak CPU.

- NEVER run whole-project typecheck, lint, or similar commands
  (`tsc --noEmit`, `vp check`, `vp test`, full builds for verification).
- NEVER parallelize tool calls or shell commands. One thing at a time.
- The dev server is usually already running and auto-generates routes.
  Do not run `tsr generate` or start another dev server.
- Verify by careful reading, not by running heavy commands.
- NEVER deploy (`bun run deploy`, `wrangler deploy`) until the owner explicitly
  orders it. They are on a limited data plan.
- NEVER download anything (binaries, browsers, datasets, large packages)
  without explicit permission. Same reason. Reuse what is already installed.

## Project rules (artchive)

General rules distilled from owner feedback. Follow these unless explicitly told otherwise.

- **Cojeev first.** Use registry components before building custom ones, and
  use their variants and APIs as designed (`selected` states, tab variants,
  dialog parts). Never override layered Cojeev styles with plain utilities;
  switch variants by breakpoint instead of restyling one variant.
- **Copy.** No em dashes in user-facing text (period, colon, or middot).
  Brand is "Artchive"; lowercase only for identifiers (URLs, keys, emails).
- **Forms.** TanStack Form + Zod everywhere: schemas next to usage, live and
  submit validation, vertically stacked fields, one shared width, one heading
  per card. No per-field `useState`.
- **Feedback.** Mutation outcomes go to toasts with humanized copy, never raw
  error codes. Destructive actions need typed confirmation in a dialog whose
  title stacks above its description and whose buttons share one size.
- **Auth.** Split routes under a persistent layout, verification-gated
  sign-in, OAuth with a username-claim onboarding step, enumeration-safe
  errors throughout. Usernames follow one shared policy (shape + reserved
  names) enforced identically on client, server, and plugin.
- **Data.** Zod-validated env from merged sources; secrets only via
  `wrangler secret` and `.dev.vars`; migrate dev and remote databases
  together; destructive deletes must cascade.
- **Code.** `@/` imports only. Comments must prevent a bug or document a
  non-obvious contract, otherwise delete them.
- **Dark surfaces need separation.** The rail's dark fill is near-identical
  to the page canvas, so it carries a `structure-line` hairline border.
  Verify dark mode with real screenshots, never token math.
- **Motion everywhere, tastefully.** Feed cards enter with a capped stagger,
  app routes fade on navigation, tab content animates via the registry.
  Always Cojeev `MotionSurface` presets (they read the shared choreography,
  so the `MotionControls` adjuster in settings governs them); never custom
  keyframes except ambient loops like the auth collage. When shadcn skips
  CSS imports, add the missing `@/styles/cojeev/*.css` lines manually.
  The rail fold tweens width through `motion.create(Sidebar)` with the
  choreography transition (plus `transition-none!` to silence the static CSS
  tween); it goes instant when motion is off.
- **App shell.** Cojeev `Sidebar` + slim topbar + mobile bottom tabs.
  Navigation lives in `@/components/app-nav`; the create-pin dialog mounts
  once and opens via the `openCreatePin()` store. No Navbar. Fold state
  lives in `RailProvider` (persisted); the fold toggle sits in the topbar,
  never the rail. Create is a default accent button first in the rail. The
  avatar opens a dropdown user menu (Profile, Settings, Admin for admins,
  Sign out) in both topbars; the rail holds navigation only.
- **Menu rows use Cojeev `Icon`, never lucide inside menus.** The registry
  only recognizes its own visuals and injects an automatic adornment next
  to anything else, rendering two icons. Never use the browser for this
  class of issue; the registry contract is readable in code.
