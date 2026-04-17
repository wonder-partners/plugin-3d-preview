import PluginFileManagerServer from '@nocobase/plugin-file-manager/server';
import { ENVIRONMENT_MAP_STORAGE_SETTING_KEY, SETTINGS_RESOURCE } from '../constants';

export type EnvironmentMapStorageSettingValue = {
  storageName: string | null;
};

export function getFileManagerPlugin(plugin: any) {
  return plugin.app.pm.get(PluginFileManagerServer);
}

export async function getFileManagerStorages(plugin: any) {
  const fileManager = getFileManagerPlugin(plugin);

  if (!fileManager) {
    throw new Error('File Manager plugin is not available');
  }

  if (!fileManager.storagesCache?.size && typeof fileManager.loadStorages === 'function') {
    await fileManager.loadStorages();
  }

  return Array.from(fileManager.storagesCache?.values?.() || []);
}

export function sortStorages(storages: any[]) {
  return [...storages].sort((a, b) => {
    if (a.default && !b.default) {
      return -1;
    }

    if (!a.default && b.default) {
      return 1;
    }

    return String(a.title || a.name).localeCompare(String(b.title || b.name));
  });
}

export function serializeStorage(storage: any) {
  return {
    id: storage.id,
    name: storage.name,
    title: storage.title,
    type: storage.type,
    default: storage.default,
    rules: storage.rules,
  };
}

export function serializeResolvedEnvironmentMapStorage(resolved: {
  storageName: string | null;
  effectiveStorage?: any;
  missingStorageName?: string;
}) {
  return {
    storageName: resolved.storageName,
    effectiveStorageName: resolved.effectiveStorage?.name || null,
    effectiveStorageTitle: resolved.effectiveStorage?.title || null,
    missingStorageName: resolved.missingStorageName,
  };
}

export function getDefaultStorage(storages: any[]) {
  return storages.find((storage) => storage.default) || storages[0] || null;
}

export function findStorageByName(storages: any[], storageName?: string | null) {
  if (!storageName) {
    return null;
  }

  return storages.find((storage) => storage.name === storageName) || null;
}

function normalizeEnvironmentMapStorageSettingValue(value: any): EnvironmentMapStorageSettingValue {
  let parsedValue = value || {};

  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch (error) {
      parsedValue = {};
    }
  }

  const storageName =
    parsedValue && typeof parsedValue.storageName === 'string' && parsedValue.storageName
      ? parsedValue.storageName
      : null;

  return {
    storageName,
  };
}

export async function getEnvironmentMapStorageSetting(plugin: any, transaction?: any) {
  const repository = plugin.db.getRepository(SETTINGS_RESOURCE);
  const record = await repository.findOne({
    filter: {
      key: ENVIRONMENT_MAP_STORAGE_SETTING_KEY,
    },
    transaction,
  });

  return normalizeEnvironmentMapStorageSettingValue(record?.get('value'));
}

export async function setEnvironmentMapStorageSetting(plugin: any, storageName: string | null, transaction?: any) {
  const repository = plugin.db.getRepository(SETTINGS_RESOURCE);
  const existing = await repository.findOne({
    filter: {
      key: ENVIRONMENT_MAP_STORAGE_SETTING_KEY,
    },
    transaction,
  });
  const value: EnvironmentMapStorageSettingValue = {
    storageName,
  };

  if (existing) {
    await repository.update({
      filterByTk: existing.get(repository.collection.filterTargetKey || 'id'),
      values: {
        key: ENVIRONMENT_MAP_STORAGE_SETTING_KEY,
        value,
      },
      transaction,
    });
    return;
  }

  await repository.create({
    values: {
      key: ENVIRONMENT_MAP_STORAGE_SETTING_KEY,
      value,
    },
    transaction,
  });
}

export async function resolveEnvironmentMapStorage(plugin: any, transaction?: any) {
  const [setting, storages] = await Promise.all([
    getEnvironmentMapStorageSetting(plugin, transaction),
    getFileManagerStorages(plugin),
  ]);
  const configuredStorage = findStorageByName(storages, setting.storageName);
  const defaultStorage = getDefaultStorage(storages);
  const effectiveStorage = configuredStorage || defaultStorage;

  return {
    storageName: setting.storageName,
    effectiveStorage,
    missingStorageName: setting.storageName && !configuredStorage ? setting.storageName : undefined,
    storages,
  };
}
