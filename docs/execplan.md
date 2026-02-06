# Account Identifier — Full Implementation ExecPlan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md` at the repository root.


## Purpose / Big Picture

After this work is complete, a Firefox user who has Multi-Account Containers installed will be able to assign GitHub accounts (and, eventually, accounts from other services) to specific containers. When the user opens a GitHub page belonging to a different account than the one associated with the current container, the extension will automatically close the tab and reopen the same URL in the correct container. The user configures account-to-container mappings through the extension's popup UI.

To see it working: install the extension in Firefox, open the popup, assign "user-a" to a container named "Personal" and "user-b" to a container named "Work". Navigate to `https://github.com/user-b` in the "Personal" container. The tab will close and the same URL will reopen inside the "Work" container.


## Progress

Milestone 1 — Shared types, storage layer, WXT config:
- [x] (2026-02-06T00:00Z) Create `lib/types.ts` with ServiceId, ServiceMapping, ContainerMapping, MessageRequest, MessageResponse, BackgroundToContentMessage
- [x] (2026-02-06T00:00Z) Create `lib/storage.ts` with containerMappings storage item
- [x] (2026-02-06T00:00Z) Edit `wxt.config.ts` to add permissions, host_permissions, browser_specific_settings
- [x] (2026-02-06T00:00Z) Verify `pnpm run build:firefox` succeeds and manifest.json contains correct permissions
- [x] (2026-02-06T00:00Z) Verify `pnpm run compile` passes with zero errors

Milestone 2 — Service provider system:
- [x] (2026-02-06T00:00Z) Create `lib/providers/types.ts` with ServiceProvider interface
- [x] (2026-02-06T00:00Z) Create `lib/providers/github.ts` with GitHub provider and excludedPaths
- [x] (2026-02-06T00:00Z) Create `lib/providers/index.ts` with registry, getProviderForUrl, getProviderHosts, matchesUrlPattern
- [x] (2026-02-06T00:00Z) Verify `pnpm run compile` passes with zero errors

Milestone 3 — Background script:
- [x] (2026-02-06T00:00Z) Implement getContainerInfo message handler in `entrypoints/background.ts`
- [x] (2026-02-06T00:00Z) Implement getMappings message handler with stale-container pruning and contextualIdentities graceful fallback
- [x] (2026-02-06T00:00Z) Implement openInContainer message handler with windowId/index/active/pinned preservation and try/catch error handling
- [x] (2026-02-06T00:00Z) Implement webNavigation.onHistoryStateUpdated listener with dynamic host filter from getProviderHosts()
- [x] (2026-02-06T00:00Z) Verify `pnpm run compile` passes with zero errors

Milestone 4 — Content script:
- [x] (2026-02-06T00:00Z) Implement checkCurrentPage flow in `entrypoints/content.ts` with isChecking concurrency guard
- [x] (2026-02-06T00:00Z) Implement findRedirectTarget with current-container-is-valid logic
- [x] (2026-02-06T00:00Z) Add recheckUrl message listener (typed via BackgroundToContentMessage) for SPA navigation
- [x] (2026-02-06T00:00Z) Add popstate listener for browser back/forward
- [x] (2026-02-06T00:00Z) Use `"fromSender"` typed sentinel for currentTabId
- [x] (2026-02-06T00:00Z) Verify `pnpm run compile` passes with zero errors

Milestone 5 — Popup UI:
- [x] (2026-02-06T00:00Z) Replace `entrypoints/popup/App.tsx` with mapping management UI (App, ContainerSection, ServiceSection)
- [x] (2026-02-06T00:00Z) Implement stale-container pruning on popup load
- [x] (2026-02-06T00:00Z) Implement contextualIdentities unavailability error message
- [x] (2026-02-06T00:00Z) Replace `entrypoints/popup/App.css` with popup-appropriate styles
- [x] (2026-02-06T00:00Z) Replace `entrypoints/popup/style.css` with minimal reset styles
- [ ] (pending) Verify `pnpm run dev:firefox` loads and popup displays containers correctly
- [ ] (pending) Verify mappings persist across popup close/reopen

Milestone 6 — Integration and end-to-end validation:
- [ ] (pending) Verify correct-container scenario (no redirect)
- [ ] (pending) Verify wrong-container scenario (automatic redirect to correct container)
- [ ] (pending) Verify unmapped-account scenario (no action)
- [ ] (pending) Verify SPA navigation triggers re-evaluation
- [ ] (pending) Verify duplicate-mapping scenario (current container treated as valid)
- [ ] (pending) Verify stale-container pruning after container deletion
- [ ] (pending) Verify pinned/background tab state preservation during redirect
- [ ] (pending) Verify excluded paths do not trigger detection
- [ ] (pending) Verify rapid SPA navigation does not cause duplicate tab creation (concurrency guard)
- [ ] (pending) Verify graceful error when Multi-Account Containers is unavailable (popup shows message)
- [x] (2026-02-06T00:00Z) Verify `pnpm run build:firefox` produces clean production build
- [x] (2026-02-06T00:00Z) Verify `pnpm run compile` passes with zero errors

Timestamp format: when an item is completed, replace `(pending)` with the ISO 8601 timestamp, e.g. `(2026-02-05T14:30Z)`.


## Surprises & Discoveries

- `wxt/storage` is not the correct import path in WXT 0.20.x; the correct path is `wxt/utils/storage`. The plan referenced `wxt/storage` but the actual package exports storage from `wxt/utils/storage`.
- `@wxt-dev/browser` types are Chrome-based and do not include Firefox-specific APIs (`contextualIdentities`, `cookieStoreId` on tabs). Created `lib/firefox.d.ts` with standalone Firefox type definitions and used type assertions (`as unknown as FirefoxTab`, etc.) in the background script and popup rather than module augmentation, because `WxtBrowser` is a type alias (not an interface) and cannot be extended via declaration merging.


## Decision Log

- Decision: Use WXT built-in `wxt/storage` with `storage.defineItem()` instead of raw `browser.storage.local`.
  Rationale: WXT storage provides typed access, fallback values, cross-context reactivity (background, content, popup all share the same API), and built-in migration support for future schema changes. This avoids writing a manual wrapper around `browser.storage.local`.
  Date/Author: 2026-02-05 / plan author

- Decision: Use native `browser.runtime.sendMessage` / `browser.runtime.onMessage` for background-content messaging instead of `@webext-core/messaging`.
  Rationale: The project has very few message types (getContainerInfo, getMappings, openInContainer, recheckUrl). Adding an external dependency for type-safe messaging is unnecessary overhead at this scale. A simple discriminated-union message type provides adequate type safety with no extra dependency.
  Date/Author: 2026-02-05 / plan author

- Decision: Content script sends `openInContainer` to background, and background performs both `tabs.create` and `tabs.remove`. Content script does not close the tab itself.
  Rationale: Content scripts do not have the `tabs` permission. The background script has access to `browser.tabs` and can atomically create the new tab and remove the old one.
  Date/Author: 2026-02-05 / plan author

- Decision: When the same account ID is mapped to multiple containers, treat the current container as valid if it is among the matches (do not redirect).
  Rationale: The popup UI does not enforce uniqueness of account IDs across containers, so a user may intentionally or accidentally map the same account to more than one container. If `findCorrectContainer` simply returned the first match, it would redirect even when the current container is a valid match, causing unnecessary tab closures. The fix is to collect all matching containers and only redirect if the current container is not among them. If multiple other containers match but the current one does not, the first match is used as the redirect target.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Preserve the original tab's `windowId`, `index`, `active`, and `pinned` state when creating the replacement tab in `openInContainer`.
  Rationale: `browser.tabs.create` defaults to `active: true`, unpinned, and places the tab at the end of the tab bar in the currently focused window. Without explicitly carrying over these properties, a redirect would steal focus from background tabs, move the tab to a different position or window, and lose pinned status. By passing `windowId` (same window), `index` (same position), `active` (no focus stealing), and `pinned` (keeps pinned tabs pinned), the replacement behaves exactly like the original.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Use a concurrency guard (`isChecking` flag) in the content script to prevent overlapping `checkCurrentPage` calls.
  Rationale: `checkCurrentPage` is async and involves multiple awaited message round-trips. SPA navigation events, `popstate`, and the initial page load can all trigger it concurrently. Without a guard, two overlapping runs could both send `openInContainer`, causing duplicate tab creation. A simple boolean flag is sufficient because JavaScript is single-threaded — the flag is checked synchronously before any await.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Use `"fromSender"` string literal instead of magic number `-1` for `currentTabId` when the content script cannot supply its own tab ID.
  Rationale: A typed string sentinel (`number | "fromSender"`) is self-documenting and eliminates the risk of a valid tab ID colliding with the sentinel value. The background script checks `=== "fromSender"` and falls back to `sender.tab.id`.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Build the `webNavigation.onHistoryStateUpdated` URL filter dynamically from the provider registry via `getProviderHosts()`.
  Rationale: Hardcoding `{ hostEquals: "github.com" }` means that adding a new provider (e.g. GitLab) requires remembering to update the background script filter separately. By extracting hostnames from `providers[].urlPatterns` at startup, the filter stays in sync with the registry automatically. This is a single function call at background script initialization and has no runtime cost.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Graceful degradation when `browser.contextualIdentities` is unavailable.
  Rationale: If Multi-Account Containers is not installed or is disabled, `browser.contextualIdentities` may be undefined or `query({})` may throw. The popup shows an explicit error message guiding the user to install the extension. The background's `getMappings` handler skips pruning and returns raw mappings. The `openInContainer` handler catches `tabs.create` failures (invalid `cookieStoreId`) and logs a warning instead of crashing. This ensures the extension degrades gracefully rather than breaking silently.
  Date/Author: 2026-02-05 / plan author (review feedback)

- Decision: Prune stale container mappings when the popup loads and when the background script handles `getMappings`.
  Rationale: The requirements spec (section 2.1.2) states that when a container is deleted in Firefox, the corresponding mappings should be removed or disabled. If stale mappings remain, the redirect flow will attempt to open a tab with an invalid `cookieStoreId`, which fails silently and leaves the user stuck in the wrong container. The popup prunes on load (so users see only valid containers), and the background prunes on `getMappings` (so the content script never receives stale data even if the popup hasn't been opened recently).
  Date/Author: 2026-02-05 / plan author (review feedback)


## Outcomes & Retrospective

(To be filled at completion.)


## Context and Orientation

This project is a Firefox WebExtension built with WXT (a build framework for browser extensions) and React. The codebase was initialized from the WXT + React starter template. As of now, all three entrypoints (background, content, popup) contain only placeholder boilerplate.

The repository-relative file layout that matters:

    wxt.config.ts                    — WXT build configuration (manifest generation, modules)
    tsconfig.json                    — Extends .wxt/tsconfig.json, adds JSX support
    package.json                     — Dependencies: react, react-dom, wxt, typescript
    entrypoints/background.ts        — Background script (currently a console.log stub)
    entrypoints/content.ts           — Content script (currently matches google.com, logs)
    entrypoints/popup/index.html     — Popup HTML shell
    entrypoints/popup/main.tsx       — React root mount
    entrypoints/popup/App.tsx        — Popup React component (currently the WXT counter demo)
    entrypoints/popup/App.css        — Popup component styles (demo styles)
    entrypoints/popup/style.css      — Global popup styles (demo styles)
    docs/requirements.md             — Full requirements specification (in Japanese)

The `lib/` directory does not yet exist. It will be created to hold shared code (types, storage, providers, messaging).

Key terms used in this plan:

- **Container**: A Firefox Multi-Account Container. Each container has a unique `cookieStoreId` string (e.g. `"firefox-container-1"`). Containers isolate cookies, so different accounts can be logged in simultaneously.
- **cookieStoreId**: The string identifier Firefox assigns to each container. The default (no container) is `"firefox-default"`. Content scripts cannot read this directly; it must be obtained from the background script via `browser.tabs.get(tabId)`.
- **ServiceProvider**: A plugin object that knows how to extract the account owner from a URL for a given service (e.g. GitHub, AWS). Each provider declares URL patterns it handles and an `extractOwnerFromUrl` function.
- **ContainerMapping**: A data record linking a `cookieStoreId` to a list of services and their associated account IDs.
- **Owner**: The account name or organization name that "owns" the page being viewed (e.g. the first path segment on GitHub: `github.com/{owner}/...`).
- **WXT auto-imports**: WXT makes `defineBackground`, `defineContentScript`, and `browser` available globally in entrypoint files without explicit imports.
- **SPA (Single-Page Application)**: A web application that rewrites the current page dynamically instead of loading entire new pages from the server. GitHub is a SPA: clicking links within GitHub changes the URL via the History API without a full page reload, which means content scripts do not re-run automatically on navigation.
- **MV2 (Manifest V2)**: Version 2 of the WebExtension manifest format. WXT generates MV2 manifests for Firefox by default. MV2 uses a persistent background script (as opposed to MV3's service workers) and places host permissions inside the `permissions` array rather than a separate `host_permissions` field.
- **CRUD (Create, Read, Update, Delete)**: The four basic operations for managing data. In this plan, "CRUD" refers to the popup UI's ability to create new account mappings, read/display existing ones, update them, and delete them.

Build commands (run from the repository root):

    pnpm run dev:firefox      # Start dev mode with hot reload for Firefox
    pnpm run build:firefox    # Production build targeting Firefox
    pnpm run compile          # TypeScript type-check (no output files)


## Plan of Work

The implementation is divided into six milestones. Each milestone is independently verifiable and builds incrementally toward the full feature.


### Milestone 1 — Shared Types, Storage Layer, and WXT Configuration

This milestone creates the foundation: shared TypeScript types, a typed storage layer using WXT's built-in storage API, and the WXT configuration for Firefox permissions and host permissions.

At the end of this milestone, the extension will build for Firefox with the correct manifest permissions (`contextualIdentities`, `cookies`, `tabs`, `storage`, `webNavigation`) and host permissions (`*://github.com/*`). The storage module will be importable from any context and will be able to persist and retrieve container mappings.

**Files to create:**

`lib/types.ts` — Shared type definitions used across all contexts.

    type ServiceId = string;

    interface ServiceMapping {
      serviceId: ServiceId;
      accountIds: string[];
    }

    interface ContainerMapping {
      cookieStoreId: string;
      services: ServiceMapping[];
    }

    // Discriminated union for content → background messaging
    type MessageRequest =
      | { type: "getContainerInfo" }
      | { type: "getMappings" }
      | { type: "openInContainer"; url: string; cookieStoreId: string; currentTabId: number | "fromSender" };

    type MessageResponse =
      | { type: "containerInfo"; cookieStoreId: string }
      | { type: "mappings"; mappings: ContainerMapping[] }
      | { type: "ok" };

    // Discriminated union for background → content messaging
    type BackgroundToContentMessage =
      | { type: "recheckUrl" };

These types encode the data model from the requirements. `ServiceId` is a plain string like `"github"`. `ContainerMapping` maps one container (identified by `cookieStoreId`) to multiple services, each with multiple account IDs. `MessageRequest` and `MessageResponse` define the messages sent from content scripts to the background and the background's replies. `BackgroundToContentMessage` defines messages sent in the opposite direction — from background to content scripts. Currently it contains only `recheckUrl`, which the background sends when it detects an in-page navigation via the History API (SPA support).

`lib/storage.ts` — Typed storage using `wxt/storage`.

    import { storage } from "wxt/storage";
    import type { ContainerMapping } from "./types";

    export const containerMappings = storage.defineItem<ContainerMapping[]>(
      "local:containerMappings",
      { fallback: [] }
    );

The `storage.defineItem` call creates a reactive, typed accessor for `browser.storage.local` under the key `containerMappings`. The `fallback: []` means that if no data has been saved yet, `getValue()` returns an empty array. This accessor works identically in background, content, and popup contexts.

**Files to edit:**

`wxt.config.ts` — Add manifest permissions and Firefox-specific settings.

    import { defineConfig } from "wxt";

    export default defineConfig({
      modules: ["@wxt-dev/module-react"],
      manifest: {
        name: "Account Identifier",
        description:
          "Prevents accidental operations on wrong accounts when using Multi-Account Containers.",
        permissions: [
          "contextualIdentities",
          "cookies",
          "tabs",
          "storage",
          "webNavigation",
        ],
        host_permissions: ["*://github.com/*"],
        browser_specific_settings: {
          gecko: {
            id: "account-identifier@example.com",
            strict_min_version: "109.0",
          },
        },
      },
    });

The `permissions` array requests the Firefox APIs the extension needs. `host_permissions` grants access to GitHub pages (needed for content script injection and webNavigation filtering). The `browser_specific_settings` block sets a stable extension ID for Firefox, which is required for persistent storage across reloads during development.

**Validation:** Run `pnpm run build:firefox` from the repository root. Inspect `.output/firefox-mv2/manifest.json` (WXT outputs MV2 for Firefox by default). Confirm it contains the correct `permissions` array and the `browser_specific_settings` block. Run `pnpm run compile` and confirm no TypeScript errors.


### Milestone 2 — Service Provider System

This milestone creates the extensible provider architecture and the initial GitHub provider.

At the end of this milestone, a `getProviderForUrl` function will accept a URL and return the matching provider (or `undefined`), and the GitHub provider's `extractOwnerFromUrl` will correctly extract owners from GitHub URLs.

**Files to create:**

`lib/providers/types.ts` — The ServiceProvider interface.

    import type { ServiceId } from "../types";

    export interface ServiceProvider {
      id: ServiceId;
      displayName: string;
      urlPatterns: string[];
      extractOwnerFromUrl(url: URL): string | null;
    }

`urlPatterns` is an array of match patterns (the same format used in `content_scripts.matches` in the manifest). The `extractOwnerFromUrl` function receives a parsed `URL` object and returns the owner string (e.g. `"user-a"`) or `null` if the URL does not point to an identifiable owner's page.

`lib/providers/github.ts` — GitHub provider implementation.

    import type { ServiceProvider } from "./types";

    const excludedPaths = [
      "settings", "notifications", "new", "login", "signup",
      "explore", "topics", "trending", "collections", "events",
      "sponsors", "features", "marketplace", "pulls", "issues",
      "codespaces", "organizations",
    ];

    export const githubProvider: ServiceProvider = {
      id: "github",
      displayName: "GitHub",
      urlPatterns: ["*://github.com/*"],

      extractOwnerFromUrl(url: URL): string | null {
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length === 0) return null;

        // /orgs/{org}/... or /users/{user}/... — owner is the second segment
        if (["orgs", "users"].includes(segments[0])) {
          return segments[1] ?? null;
        }

        const owner = segments[0];
        if (excludedPaths.includes(owner)) return null;
        return owner;
      },
    };

This is the logic from the requirements document. Paths like `/settings`, `/explore`, etc. do not represent an owner and are excluded. Paths like `/orgs/my-org/repos` extract `my-org` as the owner. All other paths treat the first segment as the owner (e.g. `/user-a/repo-name` yields `user-a`).

`lib/providers/index.ts` — Provider registry.

    import type { ServiceProvider } from "./types";
    import { githubProvider } from "./github";

    const providers: ServiceProvider[] = [githubProvider];

    export function getAllProviders(): ServiceProvider[] {
      return providers;
    }

    export function getProviderForUrl(url: URL): ServiceProvider | undefined {
      return providers.find((p) => {
        return p.urlPatterns.some((pattern) => matchesUrlPattern(pattern, url));
      });
    }

    // Simple match-pattern checker for WebExtension match patterns.
    // Supports patterns of the form "*://host/*" which is sufficient for our use.
    function matchesUrlPattern(pattern: string, url: URL): boolean {
      // pattern example: "*://github.com/*"
      // Parse: scheme "://" host "/" path
      const match = pattern.match(/^(\*|https?):\/\/([^/]+)\/(.*)$/);
      if (!match) return false;
      const [, scheme, host, path] = match;

      // Check scheme
      if (scheme !== "*" && scheme !== url.protocol.replace(":", "")) return false;

      // Check host (supports leading *. for subdomain wildcard)
      if (host.startsWith("*.")) {
        const baseDomain = host.slice(2);
        if (url.hostname !== baseDomain && !url.hostname.endsWith("." + baseDomain)) return false;
      } else if (host !== url.hostname) {
        return false;
      }

      // Path: we only use "*" as a trailing wildcard, which matches everything
      if (path === "*") return true;

      return url.pathname.startsWith("/" + path.replace(/\*$/, ""));
    }

    export function getProviderHosts(): string[] {
      // Extract hostnames from all provider urlPatterns for use in
      // webNavigation filters. Parses patterns like "*://github.com/*"
      // and returns ["github.com"]. This keeps the background script's
      // SPA filter in sync with the provider registry automatically.
      const hosts = new Set<string>();
      for (const provider of providers) {
        for (const pattern of provider.urlPatterns) {
          const m = pattern.match(/^(?:\*|https?):\/\/([^/]+)\//);
          if (m) hosts.add(m[1]);
        }
      }
      return [...hosts];
    }

    export type { ServiceProvider } from "./types";

The `matchesUrlPattern` function is a minimal implementation that handles the match patterns used in WebExtension manifests. It supports `*` as a scheme wildcard and `*` as a trailing path wildcard, which covers all patterns this extension uses.

The `getProviderHosts` function extracts hostnames from the registered providers' `urlPatterns` and returns them as a plain string array. This is used by the background script to dynamically build the `webNavigation.onHistoryStateUpdated` filter, so that adding a new provider automatically extends the SPA monitoring without requiring a separate manual update to the background script.

**Validation:** Run `pnpm run compile`. No TypeScript errors should appear. The provider logic can be further validated in Milestone 6.


### Milestone 3 — Background Script

This milestone implements the background script, which serves as the central coordinator: it listens for messages from content scripts, manages tab creation in containers, and monitors URL changes for SPA support.

At the end of this milestone, the background script will respond to three message types (`getContainerInfo`, `getMappings`, `openInContainer`) and will notify content scripts when an in-page navigation occurs (SPA support via `webNavigation.onHistoryStateUpdated`).

**File to edit:**

`entrypoints/background.ts` — Replace the stub with the full implementation.

    import { containerMappings } from "@/lib/storage";
    import { getProviderHosts } from "@/lib/providers";
    import type { MessageRequest, MessageResponse, BackgroundToContentMessage } from "@/lib/types";

    export default defineBackground(() => {
      // --- Message handler ---
      browser.runtime.onMessage.addListener(
        (message: MessageRequest, sender): Promise<MessageResponse> | undefined => {
          if (message.type === "getContainerInfo") {
            // Return the cookieStoreId of the tab that sent this message.
            const tabId = sender.tab?.id;
            if (tabId == null) return undefined;
            return (async () => {
              const tab = await browser.tabs.get(tabId);
              return { type: "containerInfo" as const, cookieStoreId: tab.cookieStoreId ?? "firefox-default" };
            })();
          }

          if (message.type === "getMappings") {
            return (async () => {
              const mappings = await containerMappings.getValue();
              // Prune stale mappings for containers that no longer exist.
              // This ensures the content script never receives mappings that
              // would cause a redirect to an invalid cookieStoreId.
              // If contextualIdentities is unavailable (Multi-Account
              // Containers not installed), skip pruning and return raw
              // mappings — redirects will fail gracefully since tabs.create
              // with an invalid cookieStoreId throws, but we catch that below.
              if (browser.contextualIdentities) {
                try {
                  const containers = await browser.contextualIdentities.query({});
                  const validIds = new Set(containers.map((c) => c.cookieStoreId));
                  validIds.add("firefox-default");
                  const filtered = mappings.filter((m) => validIds.has(m.cookieStoreId));
                  if (filtered.length !== mappings.length) {
                    await containerMappings.setValue(filtered);
                  }
                  return { type: "mappings" as const, mappings: filtered };
                } catch {
                  // contextualIdentities query failed; return unpruned mappings
                }
              }
              return { type: "mappings" as const, mappings };
            })();
          }

          if (message.type === "openInContainer") {
            const tabId = message.currentTabId === "fromSender" ? sender.tab?.id : message.currentTabId;
            if (tabId == null) return undefined;
            return (async () => {
              try {
                // Look up the original tab to preserve its state.
                // We carry over windowId, index, active, and pinned to ensure
                // the replacement tab behaves exactly like the original:
                // - windowId: keeps the tab in the same window
                // - index: keeps the tab in the same position in the tab bar
                // - active: prevents background tabs from stealing focus
                // - pinned: keeps pinned tabs pinned after redirect
                const originalTab = await browser.tabs.get(tabId);
                await browser.tabs.create({
                  url: message.url,
                  cookieStoreId: message.cookieStoreId,
                  windowId: originalTab.windowId,
                  index: originalTab.index,
                  active: originalTab.active,
                  pinned: originalTab.pinned,
                });
                // Close the original tab
                await browser.tabs.remove(tabId);
              } catch {
                // Possible failures:
                // - tabs.get fails if the tab was already closed
                // - tabs.create fails if the cookieStoreId is invalid
                //   (e.g. container deleted between pruning and redirect)
                // In either case, we silently fail — the user stays on
                // the current tab, which is better than crashing.
                console.warn("openInContainer failed for tab", tabId);
              }
              return { type: "ok" as const };
            })();
          }

          return undefined;
        }
      );

      // --- SPA support ---
      // When a page navigates via History API (pushState / replaceState),
      // the content script does not re-run. We send it a message to re-check.
      // The URL filter is built dynamically from the provider registry so
      // that adding a new provider automatically extends SPA monitoring.
      const hostFilters = getProviderHosts().map((host) => ({ hostEquals: host }));
      browser.webNavigation.onHistoryStateUpdated.addListener(
        async (details) => {
          // Only care about top-level frames (frameId 0)
          if (details.frameId !== 0) return;
          try {
            const msg: BackgroundToContentMessage = { type: "recheckUrl" };
            await browser.tabs.sendMessage(details.tabId, msg);
          } catch {
            // Content script might not be injected on this page; ignore errors
          }
        },
        { url: hostFilters }
      );
    });

The `onMessage` listener uses a discriminated union on `message.type`. For `getContainerInfo`, it looks up the sender tab's `cookieStoreId`. For `getMappings`, it reads storage and prunes any mappings whose `cookieStoreId` no longer corresponds to an existing Firefox container — this prevents the content script from attempting to redirect into a deleted container, which would fail and leave the user stuck. For `openInContainer`, it resolves the tab ID (using `sender.tab.id` when the content script passes `-1`), looks up the original tab, then creates the replacement tab preserving the original's `windowId`, `index`, `active`, and `pinned` state before closing the original. Preserving these properties ensures the replacement tab behaves exactly like the original: it stays in the same window, appears at the same position in the tab bar, does not steal focus if the original was a background tab (e.g., opened via middle-click or in another window), and retains its pinned status.

The `webNavigation.onHistoryStateUpdated` listener fires when a page navigates without a full reload (common on GitHub, which is a SPA). It sends a typed `recheckUrl` message to the content script in that tab so the content script re-evaluates the new URL. The URL filter is built dynamically from `getProviderHosts()`, which extracts hostnames from all registered providers' `urlPatterns`. This means adding a new provider to the registry automatically extends SPA monitoring to that provider's hosts — no manual update to the background script is needed.

**Validation:** Run `pnpm run compile` and confirm no errors. The full behavior is validated in Milestone 6.


### Milestone 4 — Content Script

This milestone implements the content script, which runs on GitHub pages, extracts the page owner, compares it against the container mappings, and requests a redirect if there is a mismatch.

At the end of this milestone, visiting a GitHub page in the wrong container will trigger the content script to send an `openInContainer` message to the background, which will reopen the page in the correct container.

**File to edit:**

`entrypoints/content.ts` — Replace the stub with the full implementation.

    import { getProviderForUrl } from "@/lib/providers";
    import type { MessageRequest, MessageResponse, ContainerMapping, BackgroundToContentMessage } from "@/lib/types";

    export default defineContentScript({
      matches: ["*://github.com/*"],
      runAt: "document_idle",

      async main() {
        await checkCurrentPage();

        // Listen for SPA navigation notifications from background.
        // Note on typing: browser.runtime.onMessage delivers all messages
        // to all listeners in the extension. In practice this listener may
        // also receive MessageResponse objects (the replies to this script's
        // own sendMessage calls) depending on timing. The type guard
        // (message.type === "recheckUrl") ensures we only act on messages
        // we care about; other message types are silently ignored.
        browser.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
          if (message.type === "recheckUrl") {
            checkCurrentPage();
          }
        });

        // Also listen for popstate (browser back/forward)
        window.addEventListener("popstate", () => {
          checkCurrentPage();
        });
      },
    });

    // Guard against concurrent execution. SPA navigation events and the
    // initial page load can trigger checkCurrentPage simultaneously. Without
    // this guard, two concurrent runs could both reach the openInContainer
    // step, causing duplicate tab creation. The flag ensures only one check
    // runs at a time; subsequent calls while a check is in progress are
    // silently dropped (the next SPA event or navigation will re-trigger).
    let isChecking = false;

    async function checkCurrentPage(): Promise<void> {
      if (isChecking) return;
      isChecking = true;
      try {
        const url = new URL(window.location.href);

        // Step 1: Find the provider for this URL
        const provider = getProviderForUrl(url);
        if (!provider) return;

        // Step 2: Extract the owner from the URL
        const owner = provider.extractOwnerFromUrl(url);
        if (!owner) return;

        // Step 3: Get the current container's cookieStoreId
        const containerResponse = (await browser.runtime.sendMessage({
          type: "getContainerInfo",
        } satisfies MessageRequest)) as MessageResponse;
        if (containerResponse.type !== "containerInfo") return;
        const currentCookieStoreId = containerResponse.cookieStoreId;

        // Step 4: Get all container mappings
        const mappingsResponse = (await browser.runtime.sendMessage({
          type: "getMappings",
        } satisfies MessageRequest)) as MessageResponse;
        if (mappingsResponse.type !== "mappings") return;
        const mappings = mappingsResponse.mappings;

        // Step 5: Determine whether a redirect is needed.
        // findRedirectTarget returns the cookieStoreId to redirect to, or null
        // if no redirect is needed (either the current container is valid, or
        // the owner is not mapped to any container).
        const redirectTarget = findRedirectTarget(
          mappings,
          provider.id,
          owner,
          currentCookieStoreId
        );

        // If no redirect is needed, do nothing
        if (!redirectTarget) return;

        // Step 6: Request redirect to the correct container.
        // currentTabId is "fromSender" — a typed sentinel that tells the
        // background script to use sender.tab.id (since content scripts
        // cannot determine their own tab ID directly).
        await browser.runtime.sendMessage({
          type: "openInContainer",
          url: window.location.href,
          cookieStoreId: redirectTarget,
          currentTabId: "fromSender",
        } satisfies MessageRequest);
      } finally {
        isChecking = false;
      }
    }

    function findRedirectTarget(
      mappings: ContainerMapping[],
      serviceId: string,
      owner: string,
      currentCookieStoreId: string
    ): string | null {
      // Collect all containers that have this owner mapped for this service.
      const matchingContainers: string[] = [];
      for (const mapping of mappings) {
        for (const service of mapping.services) {
          if (
            service.serviceId === serviceId &&
            service.accountIds.some(
              (id) => id.toLowerCase() === owner.toLowerCase()
            )
          ) {
            matchingContainers.push(mapping.cookieStoreId);
          }
        }
      }

      // No container has this owner mapped — do nothing
      if (matchingContainers.length === 0) return null;

      // If the current container is among the matches, no redirect needed
      if (matchingContainers.includes(currentCookieStoreId)) return null;

      // Redirect to the first matching container
      return matchingContainers[0];
    }

The content script runs at `document_idle` (after the page is parsed) on all GitHub URLs. The `checkCurrentPage` function executes the full detection flow described in the requirements: find the provider, extract the owner, get the current container, load mappings, and decide whether a redirect is needed. Account ID comparison is case-insensitive because GitHub usernames and org names are case-insensitive.

A module-level `isChecking` flag prevents concurrent execution. Without it, rapid SPA navigations could trigger overlapping `checkCurrentPage` calls that both reach the `openInContainer` step, causing duplicate tab creation. The flag ensures only one check runs at a time; subsequent calls are dropped (the next navigation event will re-trigger).

The `findRedirectTarget` function collects all containers that have the owner mapped for the given service. If the current container is among the matches, no redirect occurs — this handles the case where the same account ID is mapped to multiple containers (intentionally or accidentally). Only when the current container is not among the matches does a redirect happen, targeting the first matching container.

The content script cannot determine its own tab ID directly. The `openInContainer` message uses `currentTabId: "fromSender"` — a typed string sentinel (not a magic number) that tells the background script to use `sender.tab.id`. This logic is already included in the Milestone 3 `openInContainer` handler above.

**Validation:** Run `pnpm run compile` and confirm no TypeScript errors. Full behavioral validation is in Milestone 6.


### Milestone 5 — Popup UI

This milestone replaces the WXT demo popup with the account-to-container mapping management UI. The popup allows users to view all Firefox containers, and for each container, add/remove services and account IDs.

At the end of this milestone, users can open the extension popup, see their Firefox containers listed, and add/edit/delete GitHub account IDs per container. Changes are persisted to `browser.storage.local` via the shared storage module.

**Files to edit:**

`entrypoints/popup/App.tsx` — Replace entirely with the mapping management component. The skeleton below shows the complete state management flow (load → prune → display → edit → save) and component structure. Inline comments explain each section.

    import { useState, useEffect, useCallback } from "react";
    import { containerMappings } from "@/lib/storage";
    import { getAllProviders } from "@/lib/providers";
    import type { ContainerMapping, ServiceMapping } from "@/lib/types";
    import "./App.css";

    // Firefox contextualIdentity shape (from browser.contextualIdentities.query)
    interface ContextualIdentity {
      cookieStoreId: string;
      name: string;
      color: string;
      icon: string;
    }

    function App() {
      const [containers, setContainers] = useState<ContextualIdentity[]>([]);
      const [mappings, setMappings] = useState<ContainerMapping[]>([]);
      const [error, setError] = useState<string | null>(null);

      // Load containers and mappings on mount; prune stale mappings.
      useEffect(() => {
        (async () => {
          // Check whether contextualIdentities API is available.
          // It may be missing if Multi-Account Containers is not installed.
          if (!browser.contextualIdentities) {
            setError(
              "Multi-Account Containers is not available. " +
              "Please install the Firefox Multi-Account Containers extension."
            );
            return;
          }
          try {
            const ctxList = await browser.contextualIdentities.query({});
            setContainers(ctxList);

            const stored = await containerMappings.getValue();
            // Prune mappings for containers that no longer exist
            const validIds = new Set(ctxList.map((c) => c.cookieStoreId));
            const pruned = stored.filter((m) => validIds.has(m.cookieStoreId));
            if (pruned.length !== stored.length) {
              await containerMappings.setValue(pruned);
            }
            setMappings(pruned);
          } catch (e) {
            setError("Failed to load containers. Is Multi-Account Containers enabled?");
          }
        })();
      }, []);

      // Persist mappings to storage whenever the local state changes.
      const saveMappings = useCallback(async (updated: ContainerMapping[]) => {
        setMappings(updated);
        await containerMappings.setValue(updated);
      }, []);

      // --- Mutation helpers ---

      const addService = (cookieStoreId: string, serviceId: string) => {
        const updated = [...mappings];
        let mapping = updated.find((m) => m.cookieStoreId === cookieStoreId);
        if (!mapping) {
          mapping = { cookieStoreId, services: [] };
          updated.push(mapping);
        }
        if (!mapping.services.find((s) => s.serviceId === serviceId)) {
          mapping.services.push({ serviceId, accountIds: [] });
        }
        saveMappings(updated);
      };

      const removeService = (cookieStoreId: string, serviceId: string) => {
        const updated = mappings.map((m) => {
          if (m.cookieStoreId !== cookieStoreId) return m;
          return { ...m, services: m.services.filter((s) => s.serviceId !== serviceId) };
        }).filter((m) => m.services.length > 0);
        saveMappings(updated);
      };

      const addAccount = (cookieStoreId: string, serviceId: string, accountId: string) => {
        const updated = mappings.map((m) => {
          if (m.cookieStoreId !== cookieStoreId) return m;
          return {
            ...m,
            services: m.services.map((s) => {
              if (s.serviceId !== serviceId) return s;
              if (s.accountIds.includes(accountId)) return s;
              return { ...s, accountIds: [...s.accountIds, accountId] };
            }),
          };
        });
        saveMappings(updated);
      };

      const removeAccount = (cookieStoreId: string, serviceId: string, accountId: string) => {
        const updated = mappings.map((m) => {
          if (m.cookieStoreId !== cookieStoreId) return m;
          return {
            ...m,
            services: m.services.map((s) => {
              if (s.serviceId !== serviceId) return s;
              return { ...s, accountIds: s.accountIds.filter((a) => a !== accountId) };
            }),
          };
        });
        saveMappings(updated);
      };

      // --- Render ---

      if (error) return <div className="error">{error}</div>;

      return (
        <div className="popup">
          <h1>Account Identifier</h1>
          {containers.map((container) => (
            <ContainerSection
              key={container.cookieStoreId}
              container={container}
              mapping={mappings.find((m) => m.cookieStoreId === container.cookieStoreId)}
              onAddService={(serviceId) => addService(container.cookieStoreId, serviceId)}
              onRemoveService={(serviceId) => removeService(container.cookieStoreId, serviceId)}
              onAddAccount={(serviceId, accountId) =>
                addAccount(container.cookieStoreId, serviceId, accountId)
              }
              onRemoveAccount={(serviceId, accountId) =>
                removeAccount(container.cookieStoreId, serviceId, accountId)
              }
            />
          ))}
        </div>
      );
    }

    // --- ContainerSection ---
    // Shows one container's name (with color dot) and its service mappings.

    function ContainerSection({ container, mapping, onAddService, onRemoveService, onAddAccount, onRemoveAccount }: {
      container: ContextualIdentity;
      mapping: ContainerMapping | undefined;
      onAddService: (serviceId: string) => void;
      onRemoveService: (serviceId: string) => void;
      onAddAccount: (serviceId: string, accountId: string) => void;
      onRemoveAccount: (serviceId: string, accountId: string) => void;
    }) {
      const providers = getAllProviders();
      const existingServiceIds = mapping?.services.map((s) => s.serviceId) ?? [];
      const availableProviders = providers.filter((p) => !existingServiceIds.includes(p.id));

      return (
        <section className="container-section">
          <h2>
            <span className="color-dot" style={{ backgroundColor: container.color }} />
            {container.name}
          </h2>
          {mapping?.services.map((service) => {
            const provider = providers.find((p) => p.id === service.serviceId);
            return (
              <ServiceSection
                key={service.serviceId}
                displayName={provider?.displayName ?? service.serviceId}
                service={service}
                onRemoveService={() => onRemoveService(service.serviceId)}
                onAddAccount={(accountId) => onAddAccount(service.serviceId, accountId)}
                onRemoveAccount={(accountId) => onRemoveAccount(service.serviceId, accountId)}
              />
            );
          })}
          {availableProviders.length > 0 && (
            <button
              className="add-service-btn"
              onClick={() => onAddService(availableProviders[0].id)}
            >
              + Add {availableProviders[0].displayName}
            </button>
          )}
        </section>
      );
    }

    // --- ServiceSection ---
    // Shows one service (e.g. "GitHub") and its account IDs with add/remove.

    function ServiceSection({ displayName, service, onRemoveService, onAddAccount, onRemoveAccount }: {
      displayName: string;
      service: ServiceMapping;
      onRemoveService: () => void;
      onAddAccount: (accountId: string) => void;
      onRemoveAccount: (accountId: string) => void;
    }) {
      const [inputValue, setInputValue] = useState("");

      const handleAdd = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        onAddAccount(trimmed);
        setInputValue("");
      };

      return (
        <div className="service-section">
          <div className="service-header">
            <span>{displayName}</span>
            <button onClick={onRemoveService} className="remove-btn" title="Remove service">x</button>
          </div>
          <ul className="account-list">
            {service.accountIds.map((accountId) => (
              <li key={accountId}>
                {accountId}
                <button onClick={() => onRemoveAccount(accountId)} className="remove-btn" title="Remove account">x</button>
              </li>
            ))}
          </ul>
          <div className="add-account">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Account ID"
            />
            <button onClick={handleAdd}>Add</button>
          </div>
        </div>
      );
    }

    export default App;

The state management flow is: on mount, the component loads Firefox containers and stored mappings, prunes stale entries, then renders. Every mutation (add/remove service or account) creates a new immutable mappings array, updates local state via `setMappings`, and persists to storage via `containerMappings.setValue()`. If `browser.contextualIdentities` is not available (Multi-Account Containers not installed or disabled), the popup displays an error message instead of crashing.

`entrypoints/popup/App.css` — Replace with styles appropriate for a compact popup (around 350px wide). Use the container's color from `contextualIdentities` to display a color dot or border next to each container name. Keep styles minimal and functional.

`entrypoints/popup/style.css` — Simplify to basic reset styles. Remove the WXT demo styles (centering, dark theme). Use system fonts and sensible defaults.

**Validation:** Run `pnpm run dev:firefox`, open Firefox, click the extension icon, and see the popup. Firefox containers should be listed. Add a mapping (e.g. "github" / "user-a" to a container). Close and reopen the popup; the mapping should persist.


### Milestone 6 — Integration and End-to-End Validation

This milestone validates that all pieces work together: the popup saves mappings, the content script detects mismatches, and the background script performs redirects.

At the end of this milestone, the extension is fully functional for the GitHub use case.

**End-to-end scenario:**

1. Open Firefox with Multi-Account Containers extension installed.
2. Create two containers: "Personal" and "Work" (if not already present).
3. Load the extension (`pnpm run dev:firefox`).
4. Open the extension popup. Select the "Personal" container, add GitHub service, add account "user-a".
5. Select the "Work" container, add GitHub service, add account "user-b".
6. Open a tab in the "Personal" container and navigate to `https://github.com/user-a`. Nothing should happen (correct container).
7. In the "Personal" container, navigate to `https://github.com/user-b`. The tab should close and the same URL should reopen in the "Work" container.
8. Navigate to `https://github.com/some-unknown-user`. Nothing should happen (unregistered account).
9. Test SPA navigation: in the "Personal" container on GitHub, click a link that navigates to a `user-b` repository page. The redirect should still trigger.
10. Test browser back/forward: after a redirect, press the back button. Verify that no infinite redirect loop occurs.

**Edge cases to verify:**

- Visiting `https://github.com/settings` — should not trigger any detection (excluded path).
- Visiting `https://github.com/orgs/org-name/repositories` where `org-name` is mapped — should detect and redirect if needed.
- Visiting `https://github.com/` (root) — no owner to extract, nothing happens.
- Removing a mapping from the popup and revisiting the page — redirect should stop.
- Duplicate mapping: map the same account "user-a" to both "Personal" and "Work" containers. Visit `https://github.com/user-a` in either container — no redirect should occur, because the current container is among the valid matches.
- Stale container: add a mapping to a container, then delete that container in Firefox's container settings. Reopen the popup — the stale mapping should be gone. Navigate to a page for that account — no redirect should be attempted (the stale mapping was pruned).

**Validation:** All scenarios above pass. Run `pnpm run compile` to confirm type safety. Run `pnpm run build:firefox` to confirm a clean production build.


## Concrete Steps

All commands are run from the repository root (`/Users/xpadev/IdeaProjects/account-identifier`).

**Milestone 1:**

1. Create `lib/types.ts` with the type definitions described above.
2. Create `lib/storage.ts` with the `containerMappings` storage item.
3. Edit `wxt.config.ts` to add permissions, host_permissions, and browser_specific_settings.
4. Run:

       pnpm run build:firefox

   Expected: build succeeds. Inspect `.output/firefox-mv2/manifest.json` for correct permissions.

5. Run:

       pnpm run compile

   Expected: no errors.

**Milestone 2:**

1. Create `lib/providers/types.ts` with the `ServiceProvider` interface.
2. Create `lib/providers/github.ts` with the GitHub provider.
3. Create `lib/providers/index.ts` with the registry and `getProviderForUrl`.
4. Run:

       pnpm run compile

   Expected: no errors.

**Milestone 3:**

1. Replace `entrypoints/background.ts` with the implementation described above.
2. Run:

       pnpm run compile

   Expected: no errors.

**Milestone 4:**

1. Replace `entrypoints/content.ts` with the implementation described above.
2. Run:

       pnpm run compile

   Expected: no errors.

**Milestone 5:**

1. Replace `entrypoints/popup/App.tsx` with the mapping management UI.
2. Replace `entrypoints/popup/App.css` with popup-appropriate styles.
3. Replace `entrypoints/popup/style.css` with minimal reset styles.
4. Run:

       pnpm run dev:firefox

   Expected: Firefox opens with the extension loaded. Clicking the extension icon shows the popup with container list.

**Milestone 6:**

1. Follow the end-to-end scenario described above.
2. Run:

       pnpm run build:firefox

   Expected: clean production build with no warnings.

3. Run:

       pnpm run compile

   Expected: no TypeScript errors.


## Validation and Acceptance

The extension is accepted when all of the following are true:

1. `pnpm run compile` passes with zero errors.
2. `pnpm run build:firefox` produces a clean build.
3. The popup UI shows all Firefox containers and allows adding/removing GitHub account mappings.
4. Mappings persist across popup close/reopen.
5. Navigating to a GitHub page with a mapped owner in the wrong container triggers an automatic redirect to the correct container.
6. Navigating to a GitHub page with an unmapped owner does nothing.
7. Navigating to a GitHub page with the correct owner in the correct container does nothing.
8. SPA navigation on GitHub (clicking links within GitHub that use History API) triggers re-evaluation.
9. Excluded GitHub paths (`/settings`, `/explore`, etc.) do not trigger detection.
10. Duplicate mappings (same account in multiple containers) do not cause a redirect when the current container is one of the valid matches.
11. Deleting a container in Firefox removes the corresponding mappings from storage (either when the popup is opened or when the content script requests mappings).


## Idempotence and Recovery

All steps are idempotent. Creating or overwriting files can be repeated safely. Running `pnpm run build:firefox` cleans the `.output` directory before each build. Storage data is additive — re-running the extension does not lose existing mappings.

If a milestone is partially completed, you can resume from where you left off. Each milestone's validation step confirms that the work up to that point is correct. If something is broken, fix it and re-run the validation for that milestone before proceeding.


## Artifacts and Notes

Expected manifest.json permissions section (from `.output/firefox-mv2/manifest.json` after Milestone 1 build):

    "permissions": [
      "contextualIdentities",
      "cookies",
      "tabs",
      "storage",
      "webNavigation"
    ]

Expected GitHub provider behavior:

    extractOwnerFromUrl(new URL("https://github.com/user-a/repo"))      → "user-a"
    extractOwnerFromUrl(new URL("https://github.com/orgs/org-x/repos")) → "org-x"
    extractOwnerFromUrl(new URL("https://github.com/settings"))          → null
    extractOwnerFromUrl(new URL("https://github.com/"))                  → null


## Interfaces and Dependencies

**External dependencies (already in package.json):**
- `react` ^19.2.3 — UI rendering for popup
- `react-dom` ^19.2.3 — DOM rendering for popup
- `wxt` ^0.20.6 — Build framework and browser API types
- `@wxt-dev/module-react` ^1.1.5 — WXT React integration
- `typescript` ^5.9.3 — Type checking

No new dependencies are required.

**Key interfaces that must exist after full implementation:**

In `lib/types.ts`:

    export type ServiceId = string;
    export interface ServiceMapping {
      serviceId: ServiceId;
      accountIds: string[];
    }
    export interface ContainerMapping {
      cookieStoreId: string;
      services: ServiceMapping[];
    }
    export type MessageRequest =
      | { type: "getContainerInfo" }
      | { type: "getMappings" }
      | { type: "openInContainer"; url: string; cookieStoreId: string; currentTabId: number | "fromSender" };
    export type MessageResponse =
      | { type: "containerInfo"; cookieStoreId: string }
      | { type: "mappings"; mappings: ContainerMapping[] }
      | { type: "ok" };
    export type BackgroundToContentMessage =
      | { type: "recheckUrl" };

In `lib/storage.ts`:

    export const containerMappings: WxtStorageItem<ContainerMapping[]>;

In `lib/providers/types.ts`:

    export interface ServiceProvider {
      id: ServiceId;
      displayName: string;
      urlPatterns: string[];
      extractOwnerFromUrl(url: URL): string | null;
    }

In `lib/providers/index.ts`:

    export function getAllProviders(): ServiceProvider[];
    export function getProviderForUrl(url: URL): ServiceProvider | undefined;
    export function getProviderHosts(): string[];
    export type { ServiceProvider } from "./types";
