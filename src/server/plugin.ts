import { Plugin } from '@nocobase/server';

const FILE_SETTINGS_RESOURCE = 'plugin3dPreviewFileSettings';
const ENVIRONMENT_MAPS_RESOURCE = 'plugin3dPreviewEnvironmentMaps';
const MODEL_EXTENSIONS = ['glb', 'gltf'];
const ENVIRONMENT_MAP_EXTENSIONS = ['hdr'];

function getExtension(file: any) {
  const extname = file?.get?.('extname') || file?.extname;

  if (extname) {
    return String(extname).replace(/^\./, '').toLowerCase();
  }

  const url = file?.get?.('url') || file?.get?.('filename') || file?.url || file?.filename || '';
  const parts = String(url).split('?')[0].split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function serializeAttachment(file: any) {
  if (!file) {
    return null;
  }

  const data = typeof file.toJSON === 'function' ? file.toJSON() : file;

  return {
    id: data.id,
    title: data.title,
    filename: data.filename,
    extname: data.extname,
    mimetype: data.mimetype,
    size: data.size,
    url: data.url,
  };
}

function throwHttpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  throw error;
}

async function findAttachmentById(db: any, id: any, transaction?: any) {
  if (id === null || id === undefined || id === '') {
    return null;
  }

  return db.getRepository('attachments').findOne({
    filter: {
      id,
    },
    transaction,
  });
}

async function findAttachment(ctx: any, id: any) {
  return findAttachmentById(ctx.db, id);
}

async function assertAttachmentExtension(ctx: any, id: any, extensions: string[], message: string) {
  const attachment = await findAttachment(ctx, id);

  if (!attachment || !extensions.includes(getExtension(attachment))) {
    ctx.throw(400, message);
  }

  return attachment;
}

export class Plugin3dPreviewServer extends Plugin {
  collectionSyncs = new Map<string, Promise<boolean>>();
  deletingEnvironmentMapAttachmentIds = new Set<string>();

  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    await this.ensureCollection(FILE_SETTINGS_RESOURCE);
    await this.ensureCollection(ENVIRONMENT_MAPS_RESOURCE);
    this.registerResources();
    this.registerAcl();
    this.registerEnvironmentMapHooks();
    this.registerAttachmentCleanup();
  }

  async ensureCollection(name: string) {
    if (!this.collectionSyncs.has(name)) {
      const sync = (async () => {
        const collection = this.db.getCollection(name);

        if (!collection) {
          return false;
        }

        await collection.model.sync({
          force: false,
          alter: {
            drop: false,
          },
        });

        return true;
      })().catch((error) => {
        this.collectionSyncs.delete(name);
        throw error;
      });

      this.collectionSyncs.set(name, sync);
    }

    return this.collectionSyncs.get(name);
  }

  async collectionExists(name: string, options?: any) {
    const collection = this.db.getCollection(name);
    return collection ? collection.existsInDb(options) : false;
  }

  registerResources() {
    this.app.resourcer.define({
      name: FILE_SETTINGS_RESOURCE,
      actions: {
        getForFile: this.getForFile.bind(this),
        setForFile: this.setForFile.bind(this),
      },
    });
  }

  registerAcl() {
    this.app.acl.allow(FILE_SETTINGS_RESOURCE, 'getForFile', 'loggedIn');
    this.app.acl.allow(FILE_SETTINGS_RESOURCE, 'setForFile', 'loggedIn');
    this.app.acl.allow(ENVIRONMENT_MAPS_RESOURCE, ['list', 'get', 'create', 'update', 'destroy'], 'loggedIn');
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.environmentMaps`,
      actions: [`${FILE_SETTINGS_RESOURCE}:setForFile`, `${ENVIRONMENT_MAPS_RESOURCE}:*`],
    });
  }

  registerEnvironmentMapHooks() {
    const collection = this.db.getCollection(ENVIRONMENT_MAPS_RESOURCE);

    if (!collection) {
      return;
    }

    collection.model.removeHook?.('beforeCreate', 'plugin3dPreviewEnvironmentMaps.validateAttachment');
    collection.model.removeHook?.('beforeUpdate', 'plugin3dPreviewEnvironmentMaps.validateAttachment');

    collection.model.beforeCreate('plugin3dPreviewEnvironmentMaps.validateAttachment', async (record, options: any) => {
      await this.assertHdrAttachmentId(record.get('attachmentId'), options?.transaction);
    });

    collection.model.beforeUpdate('plugin3dPreviewEnvironmentMaps.validateAttachment', async (record, options: any) => {
      if (record.changed('attachmentId')) {
        await this.assertHdrAttachmentId(record.get('attachmentId'), options?.transaction);
      }
    });
  }

  async assertHdrAttachmentId(attachmentId: any, transaction?: any) {
    if (!attachmentId) {
      throwHttpError(400, 'attachmentId is required');
    }

    const attachment = await findAttachmentById(this.db, attachmentId, transaction);

    if (!attachment) {
      throwHttpError(404, 'Attachment not found');
    }

    if (!ENVIRONMENT_MAP_EXTENSIONS.includes(getExtension(attachment))) {
      throwHttpError(400, 'Only .hdr files can be used as environment maps');
    }

    return attachment;
  }

  async findEnvironmentMapRecordByAttachmentId(attachmentId: any, transaction?: any) {
    if (!(await this.collectionExists(ENVIRONMENT_MAPS_RESOURCE, { transaction }))) {
      return null;
    }

    return this.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).findOne({
      filter: {
        attachmentId,
      },
      transaction,
    });
  }

  async resetSettingsForEnvironmentMap(attachmentId: any, transaction?: any) {
    if (!(await this.collectionExists(FILE_SETTINGS_RESOURCE, { transaction }))) {
      return;
    }

    await this.db.getRepository(FILE_SETTINGS_RESOURCE).update({
      filter: {
        environmentMapId: attachmentId,
      },
      values: {
        environmentMapId: null,
      },
      transaction,
    });
  }

  registerAttachmentCleanup() {
    this.db.on('afterDestroy', async (record, options: any = {}) => {
      const collection = record?.constructor?.collection;

      if (collection?.name === ENVIRONMENT_MAPS_RESOURCE) {
        const attachmentId = record.get('attachmentId');

        await this.resetSettingsForEnvironmentMap(attachmentId, options.transaction);

        if (this.deletingEnvironmentMapAttachmentIds.has(String(attachmentId))) {
          return;
        }

        const attachment = await findAttachmentById(this.db, attachmentId, options.transaction);

        if (!attachment) {
          return;
        }

        this.deletingEnvironmentMapAttachmentIds.add(String(attachmentId));

        try {
          await this.db.getRepository('attachments').destroy({
            filterByTk: attachmentId,
            transaction: options.transaction,
          });
        } finally {
          this.deletingEnvironmentMapAttachmentIds.delete(String(attachmentId));
        }

        return;
      }

      if (collection?.name !== 'attachments') {
        return;
      }

      const attachmentId = record.get('id');

      if (
        await this.collectionExists(FILE_SETTINGS_RESOURCE, {
          transaction: options.transaction,
        })
      ) {
        const repository = this.db.getRepository(FILE_SETTINGS_RESOURCE);

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
        this.deletingEnvironmentMapAttachmentIds.has(String(attachmentId)) ||
        !(await this.collectionExists(ENVIRONMENT_MAPS_RESOURCE, {
          transaction: options.transaction,
        }))
      ) {
        return;
      }

      await this.db.getRepository(ENVIRONMENT_MAPS_RESOURCE).destroy({
        filter: {
          attachmentId,
        },
        transaction: options.transaction,
      });
    });
  }

  async getForFile(ctx, next) {
    const { fileId } = ctx.action.params;

    if (!fileId) {
      ctx.throw(400, 'fileId is required');
    }

    const hasSettingsCollection = await this.ensureCollection(FILE_SETTINGS_RESOURCE);

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
      const environmentMapRecord = await this.findEnvironmentMapRecordByAttachmentId(environmentMapId);

      if (attachment && environmentMapRecord && ENVIRONMENT_MAP_EXTENSIONS.includes(getExtension(attachment))) {
        environmentMap = {
          ...serializeAttachment(attachment),
          title: environmentMapRecord.get('title') || serializeAttachment(attachment)?.title,
        };
      }
    }

    ctx.body = {
      fileId,
      environmentMap,
    };

    await next();
  }

  async setForFile(ctx, next) {
    const values = ctx.action.params.values || {};
    const { fileId, environmentMapId = null } = values;

    if (!fileId) {
      ctx.throw(400, 'fileId is required');
    }

    await assertAttachmentExtension(ctx, fileId, MODEL_EXTENSIONS, 'fileId must reference a GLB or GLTF attachment');

    const hasSettingsCollection = await this.ensureCollection(FILE_SETTINGS_RESOURCE);

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
      const environmentMapRecord = await this.findEnvironmentMapRecordByAttachmentId(environmentMapId);

      if (!environmentMapRecord) {
        ctx.throw(400, 'environmentMapId must reference a registered environment map');
      }

      environmentMap = {
        ...serializeAttachment(attachment),
        title: environmentMapRecord.get('title') || serializeAttachment(attachment)?.title,
      };
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
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default Plugin3dPreviewServer;
