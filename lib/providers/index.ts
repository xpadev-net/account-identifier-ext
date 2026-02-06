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
  const match = pattern.match(/^(\*|https?):\/\/([^/]+)\/(.*)$/);
  if (!match) return false;
  const [, scheme, host, path] = match;

  if (scheme !== "*" && scheme !== url.protocol.replace(":", "")) return false;

  if (host.startsWith("*.")) {
    const baseDomain = host.slice(2);
    if (url.hostname !== baseDomain && !url.hostname.endsWith("." + baseDomain)) return false;
  } else if (host !== url.hostname) {
    return false;
  }

  if (path === "*") return true;

  return url.pathname.startsWith("/" + path.replace(/\*$/, ""));
}

export function getProviderHosts(): string[] {
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
