# @wonder/plugin-3d-preview

A NocoBase plugin for previewing 3D files in GLB/GLTF format with advanced visual effects.

## Overview

This plugin integrates **Google Model Viewer** into NocoBase's file management system, enabling interactive 3D model previewing with visual effects including SSAO (ambient occlusion) and SMAA (anti-aliasing).

## Features

- Interactive 3D preview for GLB and GLTF files
- Camera controls (rotate, zoom, pan)
- Auto-rotate mode
- Fullscreen viewing
- Advanced visual effects (SSAO, SMAA, AGX tone mapping)
- Custom thumbnails with auto-rotation
- Download functionality

## Prerequisites

- NocoBase 1.x or higher
- Node.js 18.16.0 or higher
- Yarn 1.22.19 or higher

## Installation

### From tarball (Production)

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
2. Click the thumbnail to open the interactive preview
3. Use mouse controls:
   - Left-click + drag: Rotate
   - Right-click + drag: Pan
   - Scroll: Zoom
   - Fullscreen button: Toggle fullscreen mode
   - Download button: Download the file

## Configuration

Default Model Viewer settings:

```typescript
{
  fieldOfView: "30deg",
  autoRotate: true,
  cameraControls: true,
  shadowIntensity: 0.33,
  toneMapping: "agx",
  exposure: 1,
  shadowSoftness: 1
}
```

Visual effects applied automatically:

- SSAO effect for depth perception
- SMAA effect with high quality for smooth edges

To customize, edit `src/client/index.tsx`. See [Model Viewer documentation](https://modelviewer.dev/) for all available options.

## Dependencies

```json
{
  "@google/model-viewer": "^4.1.0",
  "@google/model-viewer-effects": "^1.5.0",
  "three": "^0.182.0"
}
```

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).

## Resources

- [NocoBase Documentation](https://docs.nocobase.com/)
- [Google Model Viewer](https://modelviewer.dev/)
- [Model Viewer Effects](https://www.npmjs.com/package/@google/model-viewer-effects)
