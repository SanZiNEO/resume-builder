# Host contract notes (dsh 0.2.0-rc.2)

Read this before changing anything that touches the `dsh` host. Everything below was verified against an
installed `0.2.0-rc.2` runtime — not against docs, and not against an alpha.

**Compatibility target.** The plugin is verified on `dsh` **0.2.0-rc.2** (the newest desktop build at the
time of writing) and declares `>=0.2.0-rc.2` in `peerDependencies`. Alphas of the `0.2.1` line differ in
places (see below) — re-verify before widening the range.

**Install shape.** Sources are TypeScript; `lib/` holds the build output and is what `dsh`'s loader loads:

```sh
pnpm install && pnpm build     # tsdown → lib/{index,policy,client}.js
pnpm pack                      # prepack builds first
```

Host packages (`@deepseek-ai/*`) are always external and resolved by the `dsh` runtime.

**Types.** `src/types/*.d.ts` is a hand-written transcription of the host APIs this plugin uses: the
official type packages are not published for every `dsh` version. Its value is catching API misuse at
compile time (a missing `inject` namespace, `mounted.get()` instead of `mounted.getSnapshot()`, …).
Re-check it against the installed `.d.ts` files whenever the `dsh` version moves.

## Contracts that bit us

| Area | What the host actually does |
|---|---|
| **preset** | A preset's `plugins` list is **replaced wholesale** (no inheritance), and the registry audits it: **one row that fails to import fails the whole preset**. Every package name in `cordis.patch.yml` must exist in the target runtime — `@deepseek-ai/dsh-tool-schedule` does not exist in `0.2.0-rc.2` (it is `0.2.1-alpha.x` only). After a `dsh` upgrade, re-sync the list against that version's `@deepseek-ai/dsh-web-app/presets/standard.patch.yml`. |
| **cwd** | `0.2.0-rc.2` has **no** `ctx.workingDirectory` service (that is `0.2.1-alpha.2`+). The session workspace is `agent.session.header.cwd` — for a guard, `exec.agent.session.header.cwd`. |
| **tools** | `ctx.tools.guard()` on a plain context is global; `ctx.tools.restrict()` **requires an agent scope** (it throws otherwise). This plugin only adds a guard, and mounts it inside the preset — so it applies to sessions using that preset and to nothing else. |
| **persona** | `dsh-persona` may only be mounted inside a preset (agent scope). `complete: true` collapses the whole system prompt to that one section, taking tool guidance, plan-mode text and the harness identity with it — this plugin deliberately does **not** use it. |
| **client half** | `package.json#dsh.client` plus `exports["./client"]` pointing at a **built** bundle (`window.__ModuleLoader__.load({ id, factory })`). `dsh.client.inject` only orders activation; it does not load modules. |
| **preview** | The preview tab is this plugin's own right-sidebar type (`ctx.sidebarRightTabs.register` + a body keyed under `sidebar.right.pane.tab`). A loopback iframe renders fine in both the web app and the desktop shell — but the *official* browser tab (used as a fallback) carries its own address bar, which is why the plugin ships its own type. |
| **renderer** | The YAML → HTML renderer lives in `src/render/`, runs in-process (no subprocess, no temp files), and needs no Python. PDF / long-image export needs the optional `playwright` package. `test/golden/` holds a byte-for-byte reference produced by the original Python implementation — the renderer must keep passing it. |
