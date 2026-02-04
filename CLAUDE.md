# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefox WebExtension ("Account Identifier") that prevents accidental operations on wrong accounts when using Multi-Account Containers. Detects container-account mismatches and auto-redirects to the correct container. Built with WXT + React + TypeScript.

## Commands

```bash
pnpm run dev:firefox      # Dev mode with hot reload (Firefox)
pnpm run build:firefox    # Production build (Firefox)
pnpm run compile          # TypeScript type-check (no emit)
pnpm run zip:firefox      # Package extension for distribution
```

Package manager is **pnpm**. No test framework is configured yet.

## Architecture

**WXT entry points** (`entrypoints/`):
- `background.ts` — Background script: manages mappings, handles messaging, creates tabs in containers, monitors `webNavigation.onHistoryStateUpdated` for SPA support
- `content.ts` — Content script: extracts page owner via service providers, detects container mismatch, sends `openInContainer` message to background for auto-redirect
- `popup/` — React popup UI: container-to-account mapping management (add/edit/delete)

**Shared library** (`lib/` — planned):
- `providers/` — Service provider plugins (GitHub initial, extensible to AWS/Google/GitLab). Each provider implements `ServiceProvider` interface with `extractOwnerFromUrl()`
- `storage.ts` — `browser.storage.local` wrapper for `ContainerMapping[]`
- `messaging.ts` — Background ↔ Content script messaging
- `types.ts` — Shared type definitions

**Core flow**: Content script extracts owner from URL → checks against container mappings → if mismatch, sends message to background → background opens URL in correct container tab → closes original tab.

## Key Conventions

- WXT auto-imports: `defineBackground`, `defineContentScript`, `browser`, React hooks are globally available
- Path aliases: `@/` and `~/` both resolve to project root
- WXT generates manifest.json — no manual manifest editing
- Requirements spec is in `docs/requirements.md` (Japanese)
- Firefox-only features: `contextualIdentities` API, `cookieStoreId` on tabs
