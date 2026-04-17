import type { EnvironmentMapStorageSettings, StorageOption } from '../types';

export function normalizeStorageOptions(payload: any): StorageOption[] {
  const storageOptions = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

  return storageOptions.filter((storage) => storage && typeof storage.name === 'string');
}

export function normalizeStorageSettings(payload: any): EnvironmentMapStorageSettings | null {
  const settings = payload && typeof payload === 'object' && payload.data ? payload.data : payload;

  if (!settings || typeof settings !== 'object') {
    return null;
  }

  return {
    storageName: typeof settings.storageName === 'string' ? settings.storageName : null,
    effectiveStorageName: typeof settings.effectiveStorageName === 'string' ? settings.effectiveStorageName : null,
    effectiveStorageTitle: typeof settings.effectiveStorageTitle === 'string' ? settings.effectiveStorageTitle : null,
    missingStorageName: typeof settings.missingStorageName === 'string' ? settings.missingStorageName : undefined,
  };
}

export function getDefaultStorageName(storages: StorageOption[]) {
  return (storages.find((storage) => storage.default) || storages[0])?.name || null;
}
