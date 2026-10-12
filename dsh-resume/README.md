# dsh-resume-mode

**Resume mode for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).**
One click in the sidebar turns a session into a resume advisor: it edits only your resume project's
YAML / CSS, exports on demand, and keeps a live read-only preview in the right sidebar.

中文名：**简历模式**。

```sh
dsh plugin --profile web add dsh-resume-mode
```

Restart `dsh` (or the desktop app), click **简历 / Resume** in the left sidebar, and follow the one-time
prompt: pick the resume project folder (a starter project is bundled), then chat.

## What you get

| Piece | Where |
|---|---|
| **Resume entry** in the left sidebar | Click it = enter resume mode: the project folder is registered as a workspace, a session opens in it, the preview docks on the right |
| **Resume-advisor persona** | A `resume` agent preset — the model introduces itself as your resume advisor instead of a coding agent |
| **Write boundary** | `edit` / `write` may only touch `.yaml` / `.yml` / `.css` inside the resume project; `read` is unrestricted |
| **`export` tool** | validate → render → self-contained HTML (PDF / long image with the optional Playwright) |
| **Live preview** | The plugin's own right-sidebar tab — just the page, no address bar, auto-refreshing on every change |
| **Starter project** | A complete resume project (data / styles / layouts / assets) copied to `~/.dsh/resume` on first use |

No Python, no build step for the user: the YAML → HTML renderer is TypeScript, bundled in this package,
and runs inside `dsh`'s Node process.

## Requirements

- `dsh` **0.2.0-rc.2 or newer** (declared in `peerDependencies`)
- Node `^22.19.0 || >=24.0.0` (what `dsh` itself requires)
- Optional, only for PDF / long-image export: `playwright`
  (`pnpm add playwright && npx playwright install chromium`). HTML export and the preview work without it.

## The resume project

A project is a folder with `data/` and `styles/` (plus `layouts/` and `assets/`):

```text
data/<version>/        one folder = one resume version (standard, or one per company)
styles/<group>/*.css   the shared style library
layouts/*.html         page layouts
assets/                icons and images
```

Every YAML file may end with a `reference:` block — it is stripped before rendering and is the place to
keep notes, decisions and the user's own words. The full protocol is documented for the model in
`knowledge/`, which the persona points at.

The starter project shipped here is the same project as this repository's root (the Python version lives
there); the plugin only replaces the renderer with its own TypeScript one.

## The write boundary is a safety net, not a wall

A user with a shell can bypass it in one command, and `dsh`'s sandbox limits *where* files may be written,
not *what kind*. Treat it as guard rails for the model, not as a security boundary. Reading is never
restricted: anything the model reads enters its context.

## Development

```sh
cd dsh-resume
pnpm install
pnpm typecheck     # tsc --noEmit, against the hand-written host declarations in src/types/
pnpm build         # tsdown → lib/{index,policy,client}.js + lib/render/*
pnpm test          # node --test: renderer golden test + unit tests
pnpm pack          # prepack builds first; produces the publishable tarball
```

- `src/index.ts` — host half: project directory, preview HTTP server, file watching
- `src/policy.ts` — the preset row: write guard + `export` tool
- `src/client.ts` — browser half: sidebar entry, settings page, first-run prompt, preview tab
- `src/render/` — the renderer (YAML → self-contained HTML, PDF/long image), ported from the original
  Python implementation; `test/golden/` holds a byte-for-byte reference produced by that Python version
- `src/types/` — hand-written declarations for the host APIs this plugin uses (the official type packages
  are not published for every `dsh` version)

Host packages (`@deepseek-ai/*`) are always external: `dsh` resolves them at runtime.

## License

MIT
