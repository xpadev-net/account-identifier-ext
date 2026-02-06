// Firefox-specific types used by this extension.

export interface ContextualIdentity {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
  colorCode: string;
  iconUrl: string;
}

export interface FirefoxTab {
  id?: number;
  windowId: number;
  index: number;
  active: boolean;
  pinned: boolean;
  cookieStoreId?: string;
}

export interface FirefoxCreateProperties {
  url?: string;
  cookieStoreId?: string;
  windowId?: number;
  index?: number;
  active?: boolean;
  pinned?: boolean;
}

export interface ContextualIdentitiesAPI {
  query(details: object): Promise<ContextualIdentity[]>;
  get(cookieStoreId: string): Promise<ContextualIdentity>;
}
