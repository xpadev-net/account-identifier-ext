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

  extractLoggedInUser(): string | null {
    const meta = document.querySelector('meta[name="user-login"]');
    if (!meta) return null;
    const content = meta.getAttribute("content");
    if (!content || content.trim() === "") return null;
    return content.trim();
  },

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
