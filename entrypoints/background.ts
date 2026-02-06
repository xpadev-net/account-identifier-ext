import { containerMappings } from "@/lib/storage";
import { getProviderHosts } from "@/lib/providers";
import type { MessageRequest, MessageResponse, BackgroundToContentMessage } from "@/lib/types";
import type { ContextualIdentity, FirefoxTab, FirefoxCreateProperties, ContextualIdentitiesAPI } from "@/lib/firefox";

export default defineBackground(() => {
  const contextualIdentities = (browser as unknown as { contextualIdentities?: ContextualIdentitiesAPI }).contextualIdentities;

  // --- Message handler ---
  browser.runtime.onMessage.addListener(
    (message: MessageRequest, sender): Promise<MessageResponse> | undefined => {
      if (message.type === "getContainerInfo") {
        const tabId = sender.tab?.id;
        if (tabId == null) return undefined;
        return (async () => {
          const tab = await browser.tabs.get(tabId) as unknown as FirefoxTab;
          return { type: "containerInfo" as const, cookieStoreId: tab.cookieStoreId ?? "firefox-default" };
        })();
      }

      if (message.type === "getMappings") {
        return (async () => {
          const mappings = await containerMappings.getValue();
          if (contextualIdentities) {
            try {
              const containers: ContextualIdentity[] = await contextualIdentities.query({});
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
            const originalTab = await browser.tabs.get(tabId) as unknown as FirefoxTab;
            await (browser.tabs.create as (props: FirefoxCreateProperties) => Promise<unknown>)({
              url: message.url,
              cookieStoreId: message.cookieStoreId,
              windowId: originalTab.windowId,
              index: originalTab.index,
              active: originalTab.active,
              pinned: originalTab.pinned,
            });
            await browser.tabs.remove(tabId);
          } catch {
            console.warn("openInContainer failed for tab", tabId);
          }
          return { type: "ok" as const };
        })();
      }

      return undefined;
    }
  );

  // --- SPA support ---
  const hostFilters = getProviderHosts().map((host) => ({ hostEquals: host }));
  browser.webNavigation.onHistoryStateUpdated.addListener(
    async (details) => {
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
