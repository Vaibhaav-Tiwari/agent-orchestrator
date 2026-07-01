import type { MobileSettings } from "../types";

declare const require: ((id: string) => unknown) | undefined;

const SETTINGS_KEY = "ao.mobile.settings";
const defaultSettings: MobileSettings = { daemonUrl: "" };
let memorySettings: MobileSettings = defaultSettings;

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function loadSettings(): Promise<MobileSettings> {
  const storage = getStorage();
  if (!storage) return memorySettings;
  const raw = await storage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<MobileSettings>) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: MobileSettings): Promise<void> {
  memorySettings = settings;
  const storage = getStorage();
  if (storage) await storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getStorage(): StorageLike | null {
  const localStorageLike = globalThis as typeof globalThis & { localStorage?: StorageLike };
  if (localStorageLike.localStorage) return localStorageLike.localStorage;
  try {
    const loaded = typeof require === "function" ? require("@react-native-async-storage/async-storage") : null;
    const module = loaded as { default?: StorageLike } | StorageLike | null;
    if (!module) return null;
    if (isStorageLike(module)) return module;
    if ("default" in module && isStorageLike(module.default)) return module.default;
    return null;
  } catch {
    return null;
  }
}

function isStorageLike(value: unknown): value is StorageLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "getItem" in value &&
    "setItem" in value &&
    typeof (value as StorageLike).getItem === "function" &&
    typeof (value as StorageLike).setItem === "function"
  );
}
