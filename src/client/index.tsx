import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { saveAs } from 'file-saver';
import { attachmentFileTypes, Plugin } from '@nocobase/client';
import '@google/model-viewer';
import '@wonder-partners/model-viewer-stats';
import neutralEnv from './assets/env_neutral.jpg';

const STATS_VISIBLE_KEY = 'glb-previewer-stats-visible';

type File = {
  url: string;
  title: string;
  extname?: string;
  mimetype?: string;
};

type PreviewerProps = {
  index: number;
  list: File[];
  onSwitchIndex: (index: number | null) => void;
};

type ThumbnailProps = {
  file: File;
};

type ModelViewerProps = {
  url: string;
  title: string;
  viewerRef?: React.Ref<HTMLElement>;
  fieldOfView?: string;
  cameraControls?: boolean;
  autoRotate?: boolean;
  rotationPerSecond?: string;
  interactionPrompt?: string;
  disableZoom?: boolean;
  children?: React.ReactNode;
};

function useModelUrl(file: File) {
  return useMemo(() => {
    const src =
      file.url.startsWith('https://') || file.url.startsWith('http://')
        ? file.url
        : `${location.origin}/${file.url.replace(/^\//, '')}`;
    return src;
  }, [file.url]);
}

function ModelViewer({
  url,
  title,
  viewerRef,
  fieldOfView,
  cameraControls,
  autoRotate,
  rotationPerSecond,
  interactionPrompt,
  disableZoom,
  children,
}: ModelViewerProps) {
  return (
    <model-viewer
      ref={viewerRef}
      src={url}
      alt={title}
      field-of-view={fieldOfView}
      camera-controls={cameraControls}
      auto-rotate={autoRotate}
      rotation-per-second={rotationPerSecond}
      interaction-prompt={interactionPrompt}
      disable-zoom={disableZoom}
      tone-mapping="agx"
      environment-image={neutralEnv}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </model-viewer>
  );
}

function Previewer({ index, list, onSwitchIndex }: PreviewerProps) {
  const file = list[index];
  const modelRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<any>(null);
  const statsRef = useRef<any>(null);
  const [statsVisible, setStatsVisible] = useState(() => {
    const stored = localStorage.getItem(STATS_VISIBLE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const url = useModelUrl(file);

  useEffect(() => {
    const statsElement = statsRef.current;
    if (statsElement && !statsVisible) {
      statsElement.toggle();
    }
  }, []);

  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) {
      return;
    }

    const handleLoad = () => {
      const toneMapping = viewer.getAttribute('tone-mapping');
      if (!toneMapping) {
        return;
      }

      // Monkey-patch the tone-mapping attribute to force a re-render.
      // This is a workaround for an currently unkown bug that causes the
      // attribute to not be applied correctly on the first render.
      // We explicitly replay the attribute mutation after load to ensure
      // that the attribute is applied correctly.
      viewer.removeAttribute('tone-mapping');
      requestAnimationFrame(() => {
        viewer.setAttribute('tone-mapping', toneMapping);
      });
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [url]);

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
        <ModelViewer
          url={url}
          title={file.title}
          viewerRef={modelViewerRef}
          fieldOfView="30deg"
          cameraControls
        >
          <model-stats ref={statsRef}></model-stats>
        </ModelViewer>
      </div>
    </Modal>
  );
}

function ThumbnailPreviewer({ file }: ThumbnailProps) {
  const url = useModelUrl(file);

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
      <ModelViewer
        url={url}
        title={file.title}
        autoRotate
        rotationPerSecond="30deg"
        interactionPrompt="none"
        disableZoom
      />
    </div>
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
      Previewer,
      ThumbnailPreviewer,
    });
  }
}

export default Plugin3dPreviewClient;
