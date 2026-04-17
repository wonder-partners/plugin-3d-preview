# @wonder/plugin-3d-preview

A NocoBase plugin for previewing 3D files (GLB/GLTF) with advanced visual effects and performance monitoring.

## Features

- Interactive 3D preview with camera controls (rotate, zoom, pan)
- Visual effects: SSAO, SMAA, AGX tone mapping
- Per-file image-based lighting via uploaded environment maps
- Real-time statistics panel (geometry, textures, FPS)
- Fullscreen mode and download functionality
- Animated thumbnails with auto-rotation

## Prerequisites

- NocoBase 1.x or higher
- Node.js 18.16.0 or higher
- Yarn 1.22.19 or higher

## Installation

### From tarball (Production)

Go to the [releases](https://github.com/wonder-partners/plugin-3d-preview/releases) page and download the latest release.

```bash
# Build the plugin
yarn build @wonder/plugin-3d-preview --tar

# The tarball will be created at:
# storage/tar/@wonder/plugin-3d-preview.tar.gz

# Install via NocoBase UI at /admin/pm/list/local/
```

### Development mode

```bash
# Clone into your NocoBase workspace
cd packages/plugins/@wonder
git clone https://github.com/wonder-partners/plugin-3d-preview.git

# Install dependencies from project root
cd ../../..
yarn install
yarn nocobase upgrade

# Restart NocoBase
yarn dev

# Enable the plugin at /admin/pm/list/local/
```

see [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup instructions.

## Usage

1. Upload a `.glb` or `.gltf` file to any attachment field
2. Click the thumbnail to open the preview
3. Mouse controls: Left-drag (rotate), Right-drag (pan), Scroll (zoom)
4. Modal buttons: Statistics, Fullscreen, Download

Statistics panel shows geometry, textures, FPS, and draw calls. Visibility preference is saved per user.

## Configuration

Default settings: FOV 30°, auto-rotate, AGX tone mapping, SSAO + SMAA effects.

### HDRI management

Environment maps are configured per 3D file from HDRI records stored in the `plugin3dPreviewEnvironmentMaps` collection. The selected map is stored on the server and is shared by all users who preview the same file.

Supported uploaded format: `.hdr`.

Connected users can manage HDRI records from the global settings menu entry `3D preview`. The first `Environment maps` tab lets users upload, preview, download, and delete HDRI files. The previous direct `/admin/plugin-3d-preview/environment-maps` route is no longer registered.

New HDRI uploads use the storage configured from the second `Storage` tab in the `3D preview` settings page. Selecting `Use File Manager default storage` makes the plugin use the current default storage from File Manager. Changing this setting only affects future HDRI uploads and does not migrate existing HDRI files.

HDRI files are stored as standard NocoBase attachments, but only records in `plugin3dPreviewEnvironmentMaps` are offered by the 3D preview picker. Existing `.hdr` attachments uploaded before this development version are not imported automatically. File Manager storage rules, including size and MIME type restrictions, still apply to HDRI uploads.

Deleting an HDRI record deletes the linked attachment and resets any 3D files that used it back to the default `<model-viewer>` environment behavior.

When no environment map is configured for a file, the plugin does not set the `environment-image` attribute and `<model-viewer>` uses its default behavior. See [Model Viewer docs](https://modelviewer.dev/) for details.

## Dependencies

- `@google/model-viewer` ^4.1.0
- `@google/model-viewer-effects` ^1.5.0
- `@wonder-partners/model-viewer-stats` ^1.0.4
- `three` ^0.182.0

## Version History

**v1.1.1** - Fix click event handling
**v1.1.0** - Statistics panel with user preferences
**v1.0.0** - Initial release

## License

[AGPL-3.0](./LICENSE)

## Resources

- [NocoBase Docs](https://docs.nocobase.com/)
- [Model Viewer](https://modelviewer.dev/)
- [Contributing](./CONTRIBUTING.md)
