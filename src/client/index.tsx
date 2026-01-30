import React, { useCallback, useMemo } from 'react';
import { Modal, Button } from 'antd';
import { saveAs } from 'file-saver';
import { Plugin, attachmentFileTypes } from '@nocobase/client';
import '@google/model-viewer';

function GlbPreviewer({ index, list, onSwitchIndex }) {
  const file = list[index];
  const url = useMemo(() => {
    const src =
      file.url.startsWith('https://') || file.url.startsWith('http://')
        ? file.url
        : `${location.origin}/${file.url.replace(/^\//, '')}`;
    return src;
  }, [file.url]);

  const onDownload = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveAs(file.url, `${file.title}${file.extname}`);
    },
    [file.extname, file.title, file.url],
  );
  const onClose = useCallback(() => {
    onSwitchIndex(null);
  }, [onSwitchIndex]);

  return (
    <Modal
      open={index != null}
      title={file.title}
      onCancel={onClose}
      footer={[
        <Button key="download" onClick={onDownload}>
          Download
        </Button>,
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={'85vw'}
      centered={true}
      destroyOnClose
    >
      <div
        style={{
          width: '100%',
          height: '80vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* @ts-ignore */}
        <model-viewer
          src={url}
          alt={file.title}
          field-of-view="30deg"
          auto-rotate
          camera-controls
          shadow-intensity="0.33"
          tone-mapping="agx"
          exposure="1"
          shadow-softness="1"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </Modal>
  );
}

export class Plugin3dPreviewClient extends Plugin {
  async afterAdd() { }

  async beforeLoad() { }

  async load() {
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
      Previewer: GlbPreviewer,
    });
  }
}

export default Plugin3dPreviewClient;
