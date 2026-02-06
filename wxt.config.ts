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
        id: "account-identifier@xpa.dev",
        strict_min_version: "109.0",
        // @ts-expect-error
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
