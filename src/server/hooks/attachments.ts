import { ENVIRONMENT_MAPS_RESOURCE, FILE_SETTINGS_RESOURCE } from '../constants';
import { findAttachmentById } from '../utils/attachments';
import { collectionExists } from '../utils/collections';
import { resetSettingsForEnvironmentMap } from './environmentMaps';

export function registerAttachmentCleanup(plugin: any) {
  plugin.db.on('afterDestroy', async (record, options: any = {}) => {
    const collection = record?.constructor?.collection;

    if (collection?.name === ENVIRONMENT_MAPS_RESOURCE) {
      await cleanupEnvironmentMapRecord(plugin, record, options);
      return;
    }

    if (collection?.name === 'attachments') {
      await cleanupAttachment(plugin, record, options);
    }
  });
}

async function cleanupEnvironmentMapRecord(plugin: any, record: any, options: any) {
  const attachmentId = record.get('attachmentId');

  await resetSettingsForEnvironmentMap(plugin, attachmentId, options.transaction);

  if (plugin.deletingEnvironmentMapAttachmentIds.has(String(attachmentId))) {
    return;
  }

  const attachment = await findAttachmentById(plugin.db, attachmentId, options.transaction);

  if (!attachment) {
    return;
  }

  plugin.deletingEnvironmentMapAttachmentIds.add(String(attachmentId));

  try {
    await plugin.db.getRepository('attachments').destroy({
      filterByTk: attachmentId,
      transaction: options.transaction,
    });
  } finally {
    plugin.deletingEnvironmentMapAttachmentIds.delete(String(attachmentId));
  }
}

async function cleanupAttachment(plugin: any, record: any, options: any) {
  const attachmentId = record.get('id');

  if (
    await collectionExists(plugin.db, FILE_SETTINGS_RESOURCE, {
      transaction: options.transaction,
    })
  ) {
    const repository = plugin.db.getRepository(FILE_SETTINGS_RESOURCE);

    await repository.destroy({
      filter: {
        fileId: attachmentId,
      },
      transaction: options.transaction,
    });

    await repository.update({
      filter: {
        environmentMapId: attachmentId,
      },
      values: {
        environmentMapId: null,
      },
      transaction: options.transaction,
    });
  }

  if (
    plugin.deletingEnvironmentMapAttachmentIds.has(String(attachmentId)) ||
    !(await collectionExists(plugin.db, ENVIRONMENT_MAPS_RESOURCE, {
      transaction: options.transaction,
    }))
  ) {
    return;
  }

  await plugin.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).destroy({
    filter: {
      attachmentId,
    },
    transaction: options.transaction,
  });
}
