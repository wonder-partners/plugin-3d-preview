import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { saveAs } from 'file-saver';
import { attachmentFileTypes, Plugin } from '@nocobase/client';
import '@google/model-viewer';
import '@google/model-viewer-effects';
import '@wonder-partners/model-viewer-stats';

const STATS_VISIBLE_KEY = 'glb-previewer-stats-visible';

function GlbPreviewer({ index, list, onSwitchIndex }) {
  const file = list[index];
  const modelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<any>(null);
  const [statsVisible, setStatsVisible] = useState(() => {
    const stored = localStorage.getItem(STATS_VISIBLE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const url = useMemo(() => {
    const src =
      file.url.startsWith('https://') || file.url.startsWith('http://')
        ? file.url
        : `${location.origin}/${file.url.replace(/^\//, '')}`;
    return src;
  }, [file.url]);

  useEffect(() => {
    const statsElement = statsRef.current;
    if (statsElement && !statsVisible) {
      statsElement.toggle();
    }
  }, []);

  const onDownload = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveAs(file.url, `${file.title}${file.extname}`);
    },
    [file.extname, file.title, file.url],
  );

  const onFullscreen = useCallback(() => {
    if (modelRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        modelRef.current.requestFullscreen();
      }
    }
  }, []);

  const onToggleStats = useCallback(() => {
    if (statsRef.current && typeof statsRef.current.toggle === 'function') {
      statsRef.current.toggle();
      const newValue = !statsVisible;
      localStorage.setItem(STATS_VISIBLE_KEY, String(newValue));
      setStatsVisible(newValue);
    }
  }, [statsVisible]);

  const onClose = useCallback(() => {
    onSwitchIndex(null);
  }, [onSwitchIndex]);

  return (
    <Modal
      open={index != null}
      title={file.title}
      onCancel={onClose}
      footer={[
        <Button key="stats" onClick={onToggleStats}>
          Statistics
        </Button>,
        <Button key="fullscreen" onClick={onFullscreen}>
          Fullscreen
        </Button>,
        <Button key="download" onClick={onDownload}>
          Download
        </Button>,
      ]}
      width={'85vw'}
      centered={true}
      destroyOnClose
    >
      <div
        ref={modelRef}
        style={{
          width: '100%',
          height: '80vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
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
        >
          <effect-composer>
            <ssao-effect></ssao-effect>
            <smaa-effect quality="high"></smaa-effect>
          </effect-composer>
          <model-stats ref={statsRef}></model-stats>
        </model-viewer>
      </div>
    </Modal>
  );
}

function GlbThumbnail({ file }) {
  const url = useMemo(() => {
    const src =
      file.url.startsWith('https://') || file.url.startsWith('http://')
        ? file.url
        : `${location.origin}/${file.url.replace(/^\//, '')}`;
    return src;
  }, [file.url]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <model-viewer
        src={url}
        alt={file.title}
        auto-rotate
        rotation-per-second="30deg"
        interaction-prompt="none"
        disable-zoom
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export class Plugin3dPreviewClient extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

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
      ThumbnailPreviewer: GlbThumbnail,
    });
  }
}

export default Plugin3dPreviewClient;
