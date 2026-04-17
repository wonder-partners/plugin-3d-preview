import { SETTINGS_RESOURCE } from '../constants';
import {
  findStorageByName,
  getDefaultStorage,
  getFileManagerStorages,
  resolveEnvironmentMapStorage,
  serializeResolvedEnvironmentMapStorage,
  serializeStorage,
  setEnvironmentMapStorageSetting,
  sortStorages,
} from '../utils/environmentMapStorage';

export function registerEnvironmentMapSettingsActions(plugin: any) {
  plugin.app.resourcer.define({
    name: SETTINGS_RESOURCE,
    actions: {
      listStorages: listStorages(plugin),
      getEnvironmentMapStorage: getEnvironmentMapStorage(plugin),
      setEnvironmentMapStorage: setEnvironmentMapStorage(plugin),
    },
  });
}

function listStorages(plugin: any) {
  return async (ctx, next) => {
    const storages = sortStorages(await getFileManagerStorages(plugin));

    ctx.body = {
      data: storages.map(serializeStorage),
    };

    await next();
  };
}

function getEnvironmentMapStorage(plugin: any) {
  return async (ctx, next) => {
    const resolvedStorage = await resolveEnvironmentMapStorage(plugin);

    ctx.body = {
      data: serializeResolvedEnvironmentMapStorage(resolvedStorage),
    };

    await next();
  };
}

function setEnvironmentMapStorage(plugin: any) {
  return async (ctx, next) => {
    const values = ctx.action.params.values || {};
    const storageName = values.storageName === null || values.storageName === '' ? null : values.storageName;

    if (storageName !== null && typeof storageName !== 'string') {
      ctx.throw(400, 'storageName must be a string or null');
    }

    const storages = await getFileManagerStorages(plugin);

    if (storageName && !findStorageByName(storages, storageName)) {
      ctx.throw(400, 'storageName must reference an existing File Manager storage');
    }

    await setEnvironmentMapStorageSetting(plugin, storageName);

    const effectiveStorage = findStorageByName(storages, storageName) || getDefaultStorage(storages);

    ctx.body = {
      data: serializeResolvedEnvironmentMapStorage({
        storageName,
        effectiveStorage,
      }),
    };

    await next();
  };
}
