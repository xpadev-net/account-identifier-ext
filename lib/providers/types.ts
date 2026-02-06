import type { ServiceId } from "../types";

export interface ServiceProvider {
  id: ServiceId;
  displayName: string;
  urlPatterns: string[];
  extractOwnerFromUrl(url: URL): string | null;
  extractLoggedInUser?(): string | null;
}
