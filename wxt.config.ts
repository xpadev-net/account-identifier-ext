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
