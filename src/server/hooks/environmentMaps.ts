import { ENVIRONMENT_MAPS_RESOURCE, FILE_SETTINGS_RESOURCE } from '../constants';
import { assertHdrAttachmentId } from '../utils/attachments';
import { collectionExists } from '../utils/collections';

export function registerEnvironmentMapHooks(plugin: any) {
  const collection = plugin.db.getCollection(ENVIRONMENT_MAPS_RESOURCE);

  if (!collection) {
    return;
  }

  collection.model.removeHook?.('beforeCreate', 'plugin3dPreviewEnvironmentMaps.validateAttachment');
  collection.model.removeHook?.('beforeUpdate', 'plugin3dPreviewEnvironmentMaps.validateAttachment');

  collection.model.beforeCreate('plugin3dPreviewEnvironmentMaps.validateAttachment', async (record, options: any) => {
    await assertHdrAttachmentId(plugin.db, record.get('attachmentId'), options?.transaction);
  });

  collection.model.beforeUpdate('plugin3dPreviewEnvironmentMaps.validateAttachment', async (record, options: any) => {
    if (record.changed('attachmentId')) {
      await assertHdrAttachmentId(plugin.db, record.get('attachmentId'), options?.transaction);
    }
  });
}

export async function findEnvironmentMapRecordByAttachmentId(plugin: any, attachmentId: any, transaction?: any) {
  if (!(await collectionExists(plugin.db, ENVIRONMENT_MAPS_RESOURCE, { transaction }))) {
    return null;
  }

  return plugin.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).findOne({
    filter: {
      attachmentId,
    },
    transaction,
  });
}

export async function resetSettingsForEnvironmentMap(plugin: any, attachmentId: any, transaction?: any) {
  if (!(await collectionExists(plugin.db, FILE_SETTINGS_RESOURCE, { transaction }))) {
    return;
  }

  await plugin.db.getRepository(FILE_SETTINGS_RESOURCE).update({
    filter: {
      environmentMapId: attachmentId,
    },
    values: {
      environmentMapId: null,
    },
    transaction,
  });
}
