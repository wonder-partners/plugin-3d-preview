import { Plugin } from '@nocobase/server';
import { ENVIRONMENT_MAPS_RESOURCE, FILE_SETTINGS_RESOURCE, SETTINGS_RESOURCE } from './constants';
import { registerEnvironmentMapActions } from './actions/environmentMaps';
import { registerEnvironmentMapSettingsActions } from './actions/environmentMapSettings';
import { registerFileSettingsActions } from './actions/fileSettings';
import { registerAttachmentCleanup } from './hooks/attachments';
import { registerEnvironmentMapHooks } from './hooks/environmentMaps';
import { ensureCollection } from './utils/collections';

export class Plugin3dPreviewServer extends Plugin {
  collectionSyncs = new Map<string, Promise<boolean>>();
  deletingEnvironmentMapAttachmentIds = new Set<string>();

  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    await ensureCollection(this, FILE_SETTINGS_RESOURCE);
    await ensureCollection(this, ENVIRONMENT_MAPS_RESOURCE);
    await ensureCollection(this, SETTINGS_RESOURCE);

    registerFileSettingsActions(this);
    registerEnvironmentMapSettingsActions(this);
    registerEnvironmentMapActions(this);
    this.registerAcl();
    registerEnvironmentMapHooks(this);
    registerAttachmentCleanup(this);
  }

  registerAcl() {
    this.app.acl.allow(FILE_SETTINGS_RESOURCE, 'getForFile', 'loggedIn');
    this.app.acl.allow(FILE_SETTINGS_RESOURCE, 'setForFile', 'loggedIn');
    this.app.acl.registerSnippet({
      name: `pm.${this.name}`,
      actions: [],
    });
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.environmentMaps`,
      actions: [`${ENVIRONMENT_MAPS_RESOURCE}:*`],
    });
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.hdriStorage`,
      actions: [
        `${SETTINGS_RESOURCE}:listStorages`,
        `${SETTINGS_RESOURCE}:getEnvironmentMapStorage`,
        `${SETTINGS_RESOURCE}:setEnvironmentMapStorage`,
      ],
    });
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default Plugin3dPreviewServer;
