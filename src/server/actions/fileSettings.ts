import { ENVIRONMENT_MAP_EXTENSIONS, FILE_SETTINGS_RESOURCE, MODEL_EXTENSIONS } from '../constants';
import { ensureCollection } from '../utils/collections';
import { assertAttachmentExtension, findAttachment, getExtension, serializeAttachment } from '../utils/attachments';
import { findEnvironmentMapRecordByAttachmentId } from '../hooks/environmentMaps';

function serializeEnvironmentMap(attachment: any, environmentMapRecord: any) {
  return {
    ...serializeAttachment(attachment),
    title: environmentMapRecord.get('title') || serializeAttachment(attachment)?.title,
  };
}

export function registerFileSettingsActions(plugin: any) {
  plugin.app.resourcer.define({
    name: FILE_SETTINGS_RESOURCE,
    actions: {
      getForFile: getForFile(plugin),
      setForFile: setForFile(plugin),
    },
  });
}

function getForFile(plugin: any) {
  return async (ctx, next) => {
    const { fileId } = ctx.action.params;

    if (!fileId) {
      ctx.throw(400, 'fileId is required');
    }

    const hasSettingsCollection = await ensureCollection(plugin, FILE_SETTINGS_RESOURCE);

    if (!hasSettingsCollection) {
      ctx.body = {
        fileId,
        environmentMap: null,
      };
      await next();
      return;
    }

    const settings = await ctx.db.getRepository(FILE_SETTINGS_RESOURCE).findOne({
      filter: {
        fileId,
      },
    });

    let environmentMap = null;
    const environmentMapId = settings?.get('environmentMapId');

    if (environmentMapId) {
      const attachment = await findAttachment(ctx, environmentMapId);
      const environmentMapRecord = await findEnvironmentMapRecordByAttachmentId(plugin, environmentMapId);

      if (attachment && environmentMapRecord && ENVIRONMENT_MAP_EXTENSIONS.includes(getExtension(attachment))) {
        environmentMap = serializeEnvironmentMap(attachment, environmentMapRecord);
      }
    }

    ctx.body = {
      fileId,
      environmentMap,
    };

    await next();
  };
}

function setForFile(plugin: any) {
  return async (ctx, next) => {
    const values = ctx.action.params.values || {};
    const { fileId, environmentMapId = null } = values;

    if (!fileId) {
      ctx.throw(400, 'fileId is required');
    }

    await assertAttachmentExtension(ctx, fileId, MODEL_EXTENSIONS, 'fileId must reference a GLB or GLTF attachment');

    const hasSettingsCollection = await ensureCollection(plugin, FILE_SETTINGS_RESOURCE);

    if (!hasSettingsCollection) {
      ctx.throw(500, 'Environment map settings collection is not registered');
    }

    let environmentMap = null;

    if (environmentMapId !== null && environmentMapId !== undefined && environmentMapId !== '') {
      const attachment = await assertAttachmentExtension(
        ctx,
        environmentMapId,
        ENVIRONMENT_MAP_EXTENSIONS,
        'Only .hdr files can be used as environment maps',
      );
      const environmentMapRecord = await findEnvironmentMapRecordByAttachmentId(plugin, environmentMapId);

      if (!environmentMapRecord) {
        ctx.throw(400, 'environmentMapId must reference a registered environment map');
      }

      environmentMap = serializeEnvironmentMap(attachment, environmentMapRecord);
    }

    const repository = ctx.db.getRepository(FILE_SETTINGS_RESOURCE);
    const existing = await repository.findOne({
      filter: {
        fileId,
      },
    });

    if (existing) {
      await repository.update({
        filterByTk: existing.get(repository.collection.filterTargetKey || 'id'),
        values: {
          fileId,
          environmentMapId: environmentMap ? environmentMap.id : null,
        },
      });
    } else {
      await repository.create({
        values: {
          fileId,
          environmentMapId: environmentMap ? environmentMap.id : null,
        },
      });
    }

    ctx.body = {
      fileId,
      environmentMap,
    };

    await next();
  };
}
