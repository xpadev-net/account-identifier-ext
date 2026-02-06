export type ServiceId = string;

export interface ServiceMapping {
  serviceId: ServiceId;
  accountIds: string[];
}

export interface ContainerMapping {
  cookieStoreId: string;
  services: ServiceMapping[];
}

// Discriminated union for content → background messaging
export type MessageRequest =
  | { type: "getContainerInfo" }
  | { type: "getMappings" }
  | { type: "openInContainer"; url: string; cookieStoreId: string; currentTabId: number | "fromSender" }
  | { type: "autoRegister"; serviceId: ServiceId; accountId: string };

export type MessageResponse =
  | { type: "containerInfo"; cookieStoreId: string }
  | { type: "mappings"; mappings: ContainerMapping[] }
  | { type: "ok" }
  | { type: "autoRegisterResult"; registered: boolean };

// Discriminated union for background → content messaging
export type BackgroundToContentMessage =
  | { type: "recheckUrl" };
