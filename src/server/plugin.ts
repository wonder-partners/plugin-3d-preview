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
    url: data.url,
  };
}

async function findAttachment(ctx: any, id: any) {
  if (id === null || id === undefined || id === '') {
    return null;
  }

  return ctx.db.getRepository('attachments').findOne({
    filter: {
      id,
    },
  });
}

async function assertAttachmentExtension(ctx: any, id: any, extensions: string[], message: string) {
  const attachment = await findAttachment(ctx, id);

  if (!attachment || !extensions.includes(getExtension(attachment))) {
    ctx.throw(400, message);
  }

  return attachment;
}

export class Plugin3dPreviewServer extends Plugin {
  settingsCollectionSync: Promise<boolean> | null = null;

  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    await this.ensureSettingsCollection();
    this.registerResources();
    this.registerAcl();
    this.registerAttachmentCleanup();
  }

  async ensureSettingsCollection() {
    if (!this.settingsCollectionSync) {
      this.settingsCollectionSync = (async () => {
        const collection = this.db.getCollection(FILE_SETTINGS_RESOURCE);

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
        this.settingsCollectionSync = null;
        throw error;
      });
    }

    return this.settingsCollectionSync;
  }

  async settingsCollectionExists(options?: any) {
    const collection = this.db.getCollection(FILE_SETTINGS_RESOURCE);
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

    this.app.resourcer.define({
      name: ENVIRONMENT_MAPS_RESOURCE,
      actions: {
        list: this.listEnvironmentMaps.bind(this),
      },
    });
  }

  registerAcl() {
    this.app.acl.allow(FILE_SETTINGS_RESOURCE, 'getForFile', 'loggedIn');
    this.app.acl.allow(ENVIRONMENT_MAPS_RESOURCE, 'list', 'loggedIn');
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.environmentMaps`,
      actions: [`${FILE_SETTINGS_RESOURCE}:setForFile`],
    });
  }

  registerAttachmentCleanup() {
    this.db.on('afterDestroy', async (record, options: any = {}) => {
      const collection = record?.constructor?.collection;

      if (collection?.name !== 'attachments') {
        return;
      }

      const attachmentId = record.get('id');

      if (
        !(await this.settingsCollectionExists({
          transaction: options.transaction,
        }))
      ) {
        return;
      }

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
    });
  }

  async getForFile(ctx, next) {
    const { fileId } = ctx.action.params;

    if (!fileId) {
      ctx.throw(400, 'fileId is required');
    }

    const hasSettingsCollection = await this.ensureSettingsCollection();

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

      if (attachment && ENVIRONMENT_MAP_EXTENSIONS.includes(getExtension(attachment))) {
        environmentMap = serializeAttachment(attachment);
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

    const hasSettingsCollection = await this.ensureSettingsCollection();

    if (!hasSettingsCollection) {
      ctx.throw(500, 'Environment map settings collection is not registered');
    }

    let environmentMap = null;

    if (environmentMapId !== null && environmentMapId !== undefined && environmentMapId !== '') {
      const attachment = await assertAttachmentExtension(
        ctx,
        environmentMapId,
        ENVIRONMENT_MAP_EXTENSIONS,
        'environmentMapId must reference a supported environment map attachment',
      );
      environmentMap = serializeAttachment(attachment);
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

  async listEnvironmentMaps(ctx, next) {
    const { keyword } = ctx.action.params;
    const extensionValues = ENVIRONMENT_MAP_EXTENSIONS.flatMap((extension) => [
      `.${extension}`,
      `.${extension.toUpperCase()}`,
    ]);
    const filter: any = {
      'extname.$in': extensionValues,
    };

    if (keyword) {
      filter.$or = [
        {
          'title.$includes': keyword,
        },
        {
          'filename.$includes': keyword,
        },
      ];
    }

    const rows = await ctx.db.getRepository('attachments').find({
      filter,
      sort: ['title', 'filename'],
    });

    ctx.body = rows.map(serializeAttachment);
    await next();
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default Plugin3dPreviewServer;
