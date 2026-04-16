import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, message, Modal, Select, Space, Typography, Upload } from 'antd';
import { saveAs } from 'file-saver';
import { attachmentFileTypes, Plugin, useAPIClient } from '@nocobase/client';
import '@google/model-viewer';
import '@wonder-partners/model-viewer-stats';

const STATS_VISIBLE_KEY = 'glb-previewer-stats-visible';
const FILE_SETTINGS_RESOURCE = 'plugin3dPreviewFileSettings';
const ENVIRONMENT_MAPS_RESOURCE = 'plugin3dPreviewEnvironmentMaps';
const ENVIRONMENT_MAP_ACCEPT = '.hdr,.exr,.jpg,.jpeg,.png,.webp,image/*';

type File = {
  id?: string | number;
  url: string;
  title: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
};

type EnvironmentMap = {
  id: string | number;
  title?: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
  url?: string;
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
  environmentImage?: string;
  viewerRef?: React.Ref<HTMLElement>;
  fieldOfView?: string;
  cameraControls?: boolean;
  autoRotate?: boolean;
  rotationPerSecond?: string;
  interactionPrompt?: string;
  disableZoom?: boolean;
  toneMapping?: string;
  children?: React.ReactNode;
};

type EnvironmentMapModalProps = {
  file: File;
  open: boolean;
  environmentMap: EnvironmentMap | null;
  onClose: () => void;
  onSaved: (environmentMap: EnvironmentMap | null) => void;
};

const environmentMapCache = new Map<string, EnvironmentMap | null>();
const environmentMapSubscribers = new Set<() => void>();

function getFileId(file: File) {
  return file.id === null || file.id === undefined || file.id === '' ? null : String(file.id);
}

function getDisplayName(file?: EnvironmentMap | null) {
  if (!file) {
    return 'Default';
  }

  return file.title || file.filename || `#${file.id}`;
}

function resolveUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  return url.startsWith('https://') || url.startsWith('http://') ? url : `${location.origin}/${url.replace(/^\//, '')}`;
}

function getCachedEnvironmentMap(fileId: string) {
  return environmentMapCache.has(fileId) ? environmentMapCache.get(fileId) : undefined;
}

function setCachedEnvironmentMap(fileId: string, environmentMap: EnvironmentMap | null) {
  environmentMapCache.set(fileId, environmentMap);
  environmentMapSubscribers.forEach((listener) => listener());
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === 'function') {
    ref(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function useModelUrl(file: File) {
  return useMemo(() => resolveUrl(file.url), [file.url]);
}

function useEnvironmentMap(file: File) {
  const api = useAPIClient();
  const fileId = getFileId(file);
  const [environmentMap, setEnvironmentMap] = useState<EnvironmentMap | null | undefined>(() =>
    fileId ? getCachedEnvironmentMap(fileId) : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = () => {
      setEnvironmentMap(fileId ? getCachedEnvironmentMap(fileId) : null);
    };

    environmentMapSubscribers.add(listener);
    return () => {
      environmentMapSubscribers.delete(listener);
    };
  }, [fileId]);

  useEffect(() => {
    if (!fileId) {
      setEnvironmentMap(null);
      return;
    }

    const cached = getCachedEnvironmentMap(fileId);
    if (cached !== undefined) {
      setEnvironmentMap(cached);
      return;
    }

    let active = true;
    setLoading(true);

    api
      .request({
        url: `${FILE_SETTINGS_RESOURCE}:getForFile`,
        method: 'get',
        params: { fileId },
      })
      .then((response) => {
        if (!active) {
          return;
        }

        const nextEnvironmentMap = response?.data?.data?.environmentMap || null;
        setCachedEnvironmentMap(fileId, nextEnvironmentMap);
        setEnvironmentMap(nextEnvironmentMap);
      })
      .catch(() => {
        if (active) {
          setEnvironmentMap(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, fileId]);

  return {
    environmentMap: environmentMap || null,
    environmentImage: resolveUrl(environmentMap?.url),
    loading,
  };
}

function ModelViewer({
  url,
  title,
  environmentImage,
  viewerRef,
  fieldOfView,
  cameraControls,
  autoRotate,
  rotationPerSecond,
  interactionPrompt,
  disableZoom,
  toneMapping,
  children,
}: ModelViewerProps) {
  const internalViewerRef = useRef<HTMLElement | null>(null);

  const setViewerRef = useCallback(
    (node: HTMLElement | null) => {
      internalViewerRef.current = node;
      assignRef(viewerRef, node);
    },
    [viewerRef],
  );

  useEffect(() => {
    const viewer = internalViewerRef.current;
    if (!viewer) {
      return;
    }

    const handleLoad = () => {
      const toneMapping = viewer.getAttribute('tone-mapping');
      if (!toneMapping) {
        return;
      }

      // Replay the tone-mapping attribute mutation after load
      // to force correct application on the initial render.
      viewer.removeAttribute('tone-mapping');
      requestAnimationFrame(() => {
        viewer.setAttribute('tone-mapping', toneMapping);
      });
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [url]);

  return (
    <model-viewer
      key={`${url}:${environmentImage || 'default'}`}
      ref={setViewerRef}
      src={url}
      alt={title}
      field-of-view={fieldOfView}
      camera-controls={cameraControls}
      auto-rotate={autoRotate}
      rotation-per-second={rotationPerSecond}
      interaction-prompt={interactionPrompt}
      disable-zoom={disableZoom}
      tone-mapping={toneMapping}
      environment-image={environmentImage || undefined}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </model-viewer>
  );
}

function EnvironmentMapModal({ file, open, environmentMap, onClose, onSaved }: EnvironmentMapModalProps) {
  const api = useAPIClient();
  const fileId = getFileId(file);
  const [maps, setMaps] = useState<EnvironmentMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadEnvironmentMaps = useCallback(
    async () => {
      setLoading(true);

      try {
        const response = await api.request({
          url: `${ENVIRONMENT_MAPS_RESOURCE}:list`,
          method: 'get',
        });
        setMaps(response?.data?.data || []);
      } catch (error) {
        message.error('Unable to load environment maps');
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedMapId(environmentMap ? String(environmentMap.id) : undefined);
    loadEnvironmentMaps();
  }, [environmentMap, loadEnvironmentMaps, open]);

  const saveEnvironmentMap = useCallback(
    async (environmentMapId: string | null) => {
      if (!fileId) {
        message.warning('This file cannot be configured because it has no persisted attachment id');
        return;
      }

      setSaving(true);

      try {
        const response = await api.request({
          url: `${FILE_SETTINGS_RESOURCE}:setForFile`,
          method: 'post',
          data: {
            fileId,
            environmentMapId,
          },
        });
        const nextEnvironmentMap = response?.data?.data?.environmentMap || null;
        setCachedEnvironmentMap(fileId, nextEnvironmentMap);
        onSaved(nextEnvironmentMap);
        message.success(environmentMapId ? 'Environment map saved' : 'Environment map reset');
      } catch (error: any) {
        if (error?.response?.status === 403) {
          message.error('You do not have permission to change this environment map');
        } else {
          message.error('Unable to save environment map');
        }
      } finally {
        setSaving(false);
      }
    },
    [api, fileId, onSaved],
  );

  const uploadEnvironmentMap = useCallback(
    async (options: any) => {
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', options.file);

        const response = await api.request({
          url: 'attachments:create',
          method: 'post',
          data: formData,
        });
        const uploaded = response?.data?.data;

        if (!uploaded?.id) {
          throw new Error('Upload response did not include an attachment id');
        }

        options.onSuccess?.(uploaded);
        setMaps((currentMaps) => {
          const exists = currentMaps.some((item) => String(item.id) === String(uploaded.id));
          return exists ? currentMaps : [uploaded, ...currentMaps];
        });
        setSelectedMapId(String(uploaded.id));
        message.success('Environment map uploaded');
        await loadEnvironmentMaps();
      } catch (error) {
        options.onError?.(error);
        message.error('Unable to upload environment map');
      } finally {
        setUploading(false);
      }
    },
    [api, loadEnvironmentMaps],
  );

  return (
    <Modal
      open={open}
      title="Environment map"
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Upload accept={ENVIRONMENT_MAP_ACCEPT} customRequest={uploadEnvironmentMap} showUploadList={false}>
            <Button loading={uploading}>Upload environment map</Button>
          </Upload>
          <Space size="middle">
            <Button onClick={() => saveEnvironmentMap(null)} loading={saving}>
              Reset to default
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              disabled={!selectedMapId}
              loading={saving}
              onClick={() => saveEnvironmentMap(selectedMapId || null)}
            >
              Apply
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Typography.Text>Current: {getDisplayName(environmentMap)}</Typography.Text>
        <Select
          allowClear
          showSearch
          loading={loading}
          placeholder="Search or select an uploaded environment map"
          value={selectedMapId}
          onChange={(value) => setSelectedMapId(value)}
          optionFilterProp="label"
          filterOption={(input, option) =>
            String(option?.label || '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          options={maps.map((item) => ({
            value: String(item.id),
            label: getDisplayName(item),
          }))}
          style={{ width: '100%' }}
        />
      </Space>
    </Modal>
  );
}

function Previewer({ index, list, onSwitchIndex }: PreviewerProps) {
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

function ThumbnailPreviewer({ file }: ThumbnailProps) {
  const url = useModelUrl(file);
  const { environmentImage } = useEnvironmentMap(file);

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
        environmentImage={environmentImage}
        autoRotate
        rotationPerSecond="30deg"
        interactionPrompt="none"
        disableZoom
        toneMapping="aces"
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
      Previewer,
      ThumbnailPreviewer,
    });
  }
}

export default Plugin3dPreviewClient;
