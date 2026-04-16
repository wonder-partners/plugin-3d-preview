import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { saveAs } from 'file-saver';
import '@wonder-partners/model-viewer-stats';
import type { PreviewerProps } from '../types';
import { STATS_VISIBLE_KEY } from '../constants';
import { useEnvironmentMap } from '../hooks/useEnvironmentMap';
import { useModelUrl } from '../hooks/useModelUrl';
import { getFileId } from '../utils/files';
import { ModelViewer } from './ModelViewer';
import { EnvironmentMapModal } from './EnvironmentMapModal';

export function Previewer({ index, list, onSwitchIndex }: PreviewerProps) {
  const file = list[index];
  const modelRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<any>(null);
  const statsRef = useRef<any>(null);
  const [environmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(() => {
    const stored = localStorage.getItem(STATS_VISIBLE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const url = useModelUrl(file);
  const { environmentMap, environmentImage } = useEnvironmentMap(file);
  const fileId = getFileId(file);

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
    <>
      <Modal
        open={index != null}
        title={file.title}
        onCancel={onClose}
        footer={[
          <Button key="environment" disabled={!fileId} onClick={() => setEnvironmentModalOpen(true)}>
            Environment
          </Button>,
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
            environmentImage={environmentImage}
            viewerRef={modelViewerRef}
            fieldOfView="30deg"
            cameraControls
            toneMapping="aces"
          >
            <model-stats ref={statsRef}></model-stats>
          </ModelViewer>
        </div>
      </Modal>
      <EnvironmentMapModal
        file={file}
        open={environmentModalOpen}
        environmentMap={environmentMap}
        onClose={() => setEnvironmentModalOpen(false)}
        onSaved={() => setEnvironmentModalOpen(false)}
      />
    </>
  );
}
