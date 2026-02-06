import { getProviderForUrl } from "@/lib/providers";
import type { MessageRequest, MessageResponse, ContainerMapping, BackgroundToContentMessage } from "@/lib/types";

export default defineContentScript({
  matches: ["*://github.com/*"],
  runAt: "document_idle",

  async main() {
    await checkCurrentPage();

    browser.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
      if (message.type === "recheckUrl") {
        checkCurrentPage();
      }
    });

    window.addEventListener("popstate", () => {
      checkCurrentPage();
    });
  },
});

let isChecking = false;

async function checkCurrentPage(): Promise<void> {
  if (isChecking) return;
  isChecking = true;
  try {
    const url = new URL(window.location.href);

    const provider = getProviderForUrl(url);
    if (!provider) return;

    // Auto-register logged-in user before redirect check
    if (provider.extractLoggedInUser) {
      const loggedInUser = provider.extractLoggedInUser();
      if (loggedInUser) {
        await browser.runtime.sendMessage({
          type: "autoRegister",
          serviceId: provider.id,
          accountId: loggedInUser,
        } satisfies MessageRequest);
      }
    }

    const owner = provider.extractOwnerFromUrl(url);
    if (!owner) return;

    const containerResponse = (await browser.runtime.sendMessage({
      type: "getContainerInfo",
    } satisfies MessageRequest)) as MessageResponse;
    if (containerResponse.type !== "containerInfo") return;
    const currentCookieStoreId = containerResponse.cookieStoreId;

    const mappingsResponse = (await browser.runtime.sendMessage({
      type: "getMappings",
    } satisfies MessageRequest)) as MessageResponse;
    if (mappingsResponse.type !== "mappings") return;
    const mappings = mappingsResponse.mappings;

    const redirectTarget = findRedirectTarget(
      mappings,
      provider.id,
      owner,
      currentCookieStoreId
    );

    if (!redirectTarget) return;

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

  if (matchingContainers.length === 0) return null;
  if (matchingContainers.includes(currentCookieStoreId)) return null;

  return matchingContainers[0];
}
