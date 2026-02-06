import { storage } from "wxt/utils/storage";
import type { ContainerMapping } from "./types";

export const containerMappings = storage.defineItem<ContainerMapping[]>(
  "local:containerMappings",
  { fallback: [] }
);
