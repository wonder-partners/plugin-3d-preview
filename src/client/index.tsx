import { attachmentFileTypes, Plugin } from '@nocobase/client';
import { EnvironmentMapsAdminPage } from './components/EnvironmentMapsAdminPage';
import { Previewer } from './components/Previewer';
import { ThumbnailPreviewer } from './components/ThumbnailPreviewer';

export class Plugin3dPreviewClient extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    this.app.pluginSettingsManager.add('plugin-3d-preview.environment-maps', {
      title: '3D preview environment maps',
      icon: 'PictureOutlined',
      Component: EnvironmentMapsAdminPage,
    });

    this.router.add('admin.plugin-3d-preview.environment-maps', {
      path: '/admin/plugin-3d-preview/environment-maps',
      Component: EnvironmentMapsAdminPage,
    });

    attachmentFileTypes.add({
      match(file) {
        if (file.mimetype && ['model/gltf-binary', 'model/gltf+json'].includes(file.mimetype)) {
          return true;
        }

        if (file.url) {
          const parts = file.url.split('.');

          if (parts.length > 1) {
            const ext = parts[parts.length - 1].toLowerCase();
            return ['glb', 'gltf'].includes(ext);
          }
        }

        if (file.extname) {
          const ext = file.extname.replace('.', '').toLowerCase();
          return ['glb', 'gltf'].includes(ext);
        }

        return false;
      },
      Previewer,
      ThumbnailPreviewer,
    });
  }
}

export default Plugin3dPreviewClient;
