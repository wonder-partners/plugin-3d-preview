import {
  FILE_FIELD_NAME,
  FILE_SIZE_LIMIT_DEFAULT,
  FILE_SIZE_LIMIT_MIN,
} from '@nocobase/plugin-file-manager/server';
import { koaMulter } from '@nocobase/utils';
import { ENVIRONMENT_MAPS_RESOURCE } from '../constants';
import { assertHdrAttachmentId, serializeAttachment } from '../utils/attachments';
import { getFileManagerPlugin, resolveEnvironmentMapStorage } from '../utils/environmentMapStorage';

export function registerEnvironmentMapActions(plugin: any) {
  plugin.app.resourcer.define({
    name: ENVIRONMENT_MAPS_RESOURCE,
    actions: {
      list: listEnvironmentMaps(plugin),
      upload: uploadEnvironmentMap(plugin),
    },
  });
}

function listEnvironmentMaps(plugin: any) {
  return async (ctx, next) => {
    const { filter, page = 1, pageSize = 20, sort = ['-createdAt'] } = ctx.action.params;
    const [records, count] = await ctx.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).findAndCount({
      appends: ['attachment'],
      filter,
      page,
      pageSize,
      sort,
    });

    ctx.body = {
      data: await Promise.all(records.map((record) => serializeEnvironmentMapRecord(plugin, record))),
      meta: {
        count,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    };

    await next();
  };
}

function uploadEnvironmentMap(plugin: any) {
  return async (ctx, next) => {
    const fileManager = getFileManagerPlugin(plugin);
    const { effectiveStorage } = await resolveEnvironmentMapStorage(plugin);

    if (!effectiveStorage) {
      ctx.throw(500, 'No File Manager storage is available');
    }

    const StorageClass = fileManager.storageTypes.get(effectiveStorage.type);

    if (!StorageClass) {
      ctx.throw(500, `Storage type "${effectiveStorage.type}" is not registered`);
    }

    const storageInstance = new StorageClass(effectiveStorage);
    const upload = koaMulter({
      fileFilter: makeFileFilter(effectiveStorage),
      limits: {
        files: 1,
        fileSize: Math.max(FILE_SIZE_LIMIT_MIN, effectiveStorage.rules?.size ?? FILE_SIZE_LIMIT_DEFAULT),
      },
      storage: storageInstance.make(),
    }).single(FILE_FIELD_NAME);
    let fileData: any = null;

    try {
      await upload(ctx, () => {});
    } catch (error: any) {
      if (error?.name === 'MulterError') {
        ctx.throw(400, error.message || error);
      }

      ctx.logger?.error?.(error);
      ctx.throw(500, error.message || error);
    }

    const file = ctx[FILE_FIELD_NAME] || ctx.file;

    if (!file) {
      ctx.throw(400, 'file validation failed');
    }

    let environmentMapRecord: any = null;

    try {
      fileData = storageInstance.getFileData(file, ctx.request.body || {});
      environmentMapRecord = await ctx.db.sequelize.transaction(async (transaction) => {
        const attachment = await ctx.db.getRepository('attachments').create({
          values: {
            ...fileData,
            storage: {
              id: effectiveStorage.id,
            },
          },
          transaction,
        });

        await assertHdrAttachmentId(ctx.db, attachment.get('id'), transaction);

        const environmentMap = await ctx.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).create({
          values: {
            title: attachment.get('title') || attachment.get('filename'),
            attachmentId: attachment.get('id'),
          },
          transaction,
        });

        return ctx.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).findOne({
          filterByTk: environmentMap.get('id'),
          appends: ['attachment'],
          transaction,
        });
      });
    } catch (error) {
      if (fileData) {
        await storageInstance.delete([fileData]).catch((deleteError) => {
          ctx.logger?.warn?.(deleteError);
        });
      }

      throw error;
    }

    ctx.body = {
      data: await serializeEnvironmentMapRecord(plugin, environmentMapRecord),
    };

    await next();
  };
}

async function serializeEnvironmentMapRecord(plugin: any, record: any) {
  if (!record) {
    return null;
  }

  const data = typeof record.toJSON === 'function' ? record.toJSON() : record;
  const attachment = record.get?.('attachment') || data.attachment;

  return {
    id: data.id,
    title: data.title,
    attachmentId: data.attachmentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    attachment: await serializeEnvironmentMapAttachment(plugin, attachment),
  };
}

async function serializeEnvironmentMapAttachment(plugin: any, attachment: any) {
  const serializedAttachment = serializeAttachment(attachment);

  if (!serializedAttachment) {
    return null;
  }

  try {
    const fileManager = getFileManagerPlugin(plugin);
    const attachmentData = typeof attachment.toJSON === 'function' ? attachment.toJSON() : attachment;
    serializedAttachment.url = await fileManager.getFileURL(attachmentData);
  } catch (error) {
    // Keep the upload/list response usable even if a storage cannot generate a URL.
  }

  return serializedAttachment;
}

function makeFileFilter(storage: any) {
  const pattern = storage.rules?.mimetype;

  if (!pattern) {
    return undefined;
  }

  return (_req, file, callback) => {
    const mimetype = file.mimetype;

    if (isMimetypeAllowed(mimetype, pattern)) {
      callback(null, true);
      return;
    }

    const error: any = new Error('Mime type not allowed by storage rule');
    error.name = 'MulterError';
    callback(error);
  };
}

function isMimetypeAllowed(mimetype: string | undefined, pattern: any) {
  const rules = String(pattern)
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean);

  if (!rules.length || rules.includes('*')) {
    return true;
  }

  if (!mimetype) {
    return false;
  }

  return rules.some((rule) => {
    if (rule.endsWith('/*')) {
      return mimetype.startsWith(`${rule.slice(0, -1)}`);
    }

    return rule === mimetype;
  });
}
