import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, message, Modal, Popconfirm, Select, Space, Table, Typography, Upload } from 'antd';
import { saveAs } from 'file-saver';
import { attachmentFileTypes, Plugin, useAPIClient } from '@nocobase/client';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import '@google/model-viewer';
import '@wonder-partners/model-viewer-stats';

const STATS_VISIBLE_KEY = 'glb-previewer-stats-visible';
const FILE_SETTINGS_RESOURCE = 'plugin3dPreviewFileSettings';
const ENVIRONMENT_MAPS_RESOURCE = 'plugin3dPreviewEnvironmentMaps';
const ENVIRONMENT_MAP_ACCEPT = '.hdr';

type File = {
  id?: string | number;
  url: string;
  title: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
};

type Attachment = {
  id: string | number;
  title?: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
  size?: number;
  url?: string;
};

type EnvironmentMap = Attachment;

type EnvironmentMapRecord = {
  id: string | number;
  title?: string;
  attachmentId?: string | number;
  attachment?: Attachment;
  createdAt?: string;
  updatedAt?: string;
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
let environmentMapCacheRevision = 0;

function getFileId(file: File) {
  return file.id === null || file.id === undefined || file.id === '' ? null : String(file.id);
}

function getDisplayName(file?: EnvironmentMap | null) {
  if (!file) {
    return 'Default';
  }

  return file.title || file.filename || `#${file.id}`;
}

function getEnvironmentMapRecordAttachment(record?: EnvironmentMapRecord | null) {
  return record?.attachment || null;
}

function getEnvironmentMapRecordDisplayName(record?: EnvironmentMapRecord | null) {
  if (!record) {
    return 'Default';
  }

  const attachment = getEnvironmentMapRecordAttachment(record);
  return record.title || attachment?.title || attachment?.filename || `#${record.id}`;
}

function getEnvironmentMapExtension(file?: Attachment | null) {
  const extname = file?.extname;

  if (extname) {
    return String(extname).replace(/^\./, '').toLowerCase();
  }

  const source = file?.url || file?.filename || '';
  const parts = String(source).split('?')[0].split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isHdrAttachment(file?: Attachment | null) {
  return getEnvironmentMapExtension(file) === 'hdr';
}

function resolveUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  return url.startsWith('https://') || url.startsWith('http://') ? url : `${location.origin}/${url.replace(/^\//, '')}`;
}

function formatFileSize(size?: number) {
  if (!size) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getCachedEnvironmentMap(fileId: string) {
  return environmentMapCache.has(fileId) ? environmentMapCache.get(fileId) : undefined;
}

function setCachedEnvironmentMap(fileId: string, environmentMap: EnvironmentMap | null) {
  environmentMapCache.set(fileId, environmentMap);
  environmentMapSubscribers.forEach((listener) => listener());
}

function invalidateEnvironmentMapCache() {
  environmentMapCache.clear();
  environmentMapCacheRevision += 1;
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
  const [cacheRevision, setCacheRevision] = useState(environmentMapCacheRevision);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = () => {
      setEnvironmentMap(fileId ? getCachedEnvironmentMap(fileId) : null);
      setCacheRevision(environmentMapCacheRevision);
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
  }, [api, cacheRevision, fileId]);

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

function EnvironmentMapPreview({
  environmentMap,
  height = 140,
  emptyText = 'Select an environment map to preview it',
}: {
  environmentMap: Attachment | null;
  height?: number;
  emptyText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasState, setCanvasState] = useState<'idle' | 'loading' | 'error'>('idle');
  const previewUrl = resolveUrl(environmentMap?.url);
  const extension = getEnvironmentMapExtension(environmentMap);
  const isHdrImage = extension === 'hdr';

  useEffect(() => {
    if (!previewUrl || !isHdrImage) {
      setCanvasState('idle');
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let texture: THREE.Texture | null = null;
    let material: THREE.MeshBasicMaterial | null = null;
    let geometry: THREE.PlaneGeometry | null = null;

    const renderPreview = async () => {
      setCanvasState('loading');

      try {
        const bounds = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.floor(bounds.width || 480));
        const height = Math.max(1, Math.floor(bounds.height || 140));
        const loader = new RGBELoader();

        loader.setCrossOrigin('anonymous');
        texture = await loader.loadAsync(previewUrl);

        if (!active) {
          texture.dispose();
          return;
        }

        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        geometry = new THREE.PlaneGeometry(2, 2);
        material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        scene.add(new THREE.Mesh(geometry, material));
        renderer.render(scene, camera);
        setCanvasState('idle');
      } catch (error) {
        if (active) {
          setCanvasState('error');
        }
      }
    };

    renderPreview();

    return () => {
      active = false;
      texture?.dispose();
      material?.dispose();
      geometry?.dispose();
      renderer?.dispose();
    };
  }, [extension, height, isHdrImage, previewUrl]);

  if (!environmentMap || !previewUrl) {
    return (
      <div
        style={{
          alignItems: 'center',
          border: '1px dashed #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          height,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Typography.Text type="secondary">{emptyText}</Typography.Text>
      </div>
    );
  }

  if (!isHdrImage) {
    return (
      <div
        style={{
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          height,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Typography.Text type="secondary">Only .hdr files can be used as environment maps</Typography.Text>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#f5f5f5',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        height,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', height: '100%', width: '100%' }} />
      {canvasState !== 'idle' && (
        <div
          style={{
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.72)',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            position: 'absolute',
          }}
        >
          <Typography.Text type="secondary">
            {canvasState === 'loading' ? 'Loading preview' : 'Preview unavailable'}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}

function EnvironmentMapModal({ file, open, environmentMap, onClose, onSaved }: EnvironmentMapModalProps) {
  const api = useAPIClient();
  const fileId = getFileId(file);
  const [maps, setMaps] = useState<EnvironmentMapRecord[]>([]);
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
          params: {
            appends: ['attachment'],
            sort: ['title', '-createdAt'],
          },
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

    setSelectedMapId(undefined);
    loadEnvironmentMaps();
  }, [environmentMap, loadEnvironmentMaps, open]);

  useEffect(() => {
    if (!open || !environmentMap) {
      return;
    }

    const currentRecord = maps.find((item) => String(item.attachmentId) === String(environmentMap.id));

    if (currentRecord) {
      setSelectedMapId(String(currentRecord.id));
    }
  }, [environmentMap, maps, open]);

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

        if (!isHdrAttachment(uploaded)) {
          throw new Error('Only .hdr files can be used as environment maps');
        }

        const environmentMapResponse = await api.request({
          url: `${ENVIRONMENT_MAPS_RESOURCE}:create`,
          method: 'post',
          data: {
            title: uploaded.title || uploaded.filename,
            attachmentId: uploaded.id,
          },
        });
        const environmentMapRecord = {
          ...(environmentMapResponse?.data?.data || {}),
          attachmentId: uploaded.id,
          attachment: uploaded,
        };

        options.onSuccess?.(environmentMapRecord);
        setMaps((currentMaps) => {
          const exists = currentMaps.some((item) => String(item.id) === String(environmentMapRecord.id));
          return exists ? currentMaps : [environmentMapRecord, ...currentMaps];
        });
        setSelectedMapId(String(environmentMapRecord.id));
        invalidateEnvironmentMapCache();
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

  const selectedMap = useMemo(() => {
    if (!selectedMapId) {
      return null;
    }

    const map = maps.find((item) => String(item.id) === selectedMapId);

    return map || null;
  }, [maps, selectedMapId]);

  const selectedAttachment = getEnvironmentMapRecordAttachment(selectedMap);

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
              disabled={!selectedAttachment}
              loading={saving}
              onClick={() => saveEnvironmentMap(selectedAttachment ? String(selectedAttachment.id) : null)}
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
            label: getEnvironmentMapRecordDisplayName(item),
          }))}
          style={{ width: '100%' }}
        />
        <EnvironmentMapPreview environmentMap={selectedAttachment} />
      </Space>
    </Modal>
  );
}

function EnvironmentMapsAdminPage() {
  const api = useAPIClient();
  const [keyword, setKeyword] = useState('');
  const [records, setRecords] = useState<EnvironmentMapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const loadRecords = useCallback(
    async (nextPage = pagination.current, nextPageSize = pagination.pageSize, nextKeyword = keyword) => {
      setLoading(true);

      try {
        const filter = nextKeyword
          ? {
              'title.$includes': nextKeyword,
            }
          : undefined;
        const response = await api.request({
          url: `${ENVIRONMENT_MAPS_RESOURCE}:list`,
          method: 'get',
          params: {
            appends: ['attachment'],
            filter,
            page: nextPage,
            pageSize: nextPageSize,
            sort: ['-createdAt'],
          },
        });
        const rows = response?.data?.data || [];
        const meta = response?.data?.meta || {};

        setRecords(rows);
        setPagination({
          current: Number(meta.page || nextPage),
          pageSize: Number(meta.pageSize || nextPageSize),
          total: Number(meta.count || rows.length),
        });
      } catch (error) {
        message.error('Unable to load environment maps');
      } finally {
        setLoading(false);
      }
    },
    [api, keyword, pagination.current, pagination.pageSize],
  );

  useEffect(() => {
    loadRecords(1, pagination.pageSize);
  }, []);

  const uploadEnvironmentMap = useCallback(
    async (options: any) => {
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', options.file);

        const uploadResponse = await api.request({
          url: 'attachments:create',
          method: 'post',
          data: formData,
        });
        const uploaded = uploadResponse?.data?.data;

        if (!uploaded?.id || !isHdrAttachment(uploaded)) {
          throw new Error('Only .hdr files can be used as environment maps');
        }

        await api.request({
          url: `${ENVIRONMENT_MAPS_RESOURCE}:create`,
          method: 'post',
          data: {
            title: uploaded.title || uploaded.filename,
            attachmentId: uploaded.id,
          },
        });

        options.onSuccess?.(uploaded);
        invalidateEnvironmentMapCache();
        message.success('Environment map uploaded');
        await loadRecords(1, pagination.pageSize);
      } catch (error) {
        options.onError?.(error);
        message.error(error instanceof Error ? error.message : 'Unable to upload environment map');
      } finally {
        setUploading(false);
      }
    },
    [api, loadRecords, pagination.pageSize],
  );

  const deleteEnvironmentMap = useCallback(
    async (record: EnvironmentMapRecord) => {
      try {
        await api.request({
          url: `${ENVIRONMENT_MAPS_RESOURCE}:destroy`,
          method: 'post',
          params: {
            filterByTk: record.id,
          },
        });
        invalidateEnvironmentMapCache();
        message.success('Environment map deleted');
        await loadRecords(pagination.current, pagination.pageSize);
      } catch (error) {
        message.error('Unable to delete environment map');
      }
    },
    [api, loadRecords, pagination.current, pagination.pageSize],
  );

  const downloadEnvironmentMap = useCallback((record: EnvironmentMapRecord) => {
    const attachment = getEnvironmentMapRecordAttachment(record);
    const url = resolveUrl(attachment?.url);

    if (!url) {
      message.error('Unable to download environment map');
      return;
    }

    saveAs(url, attachment?.filename || `${getEnvironmentMapRecordDisplayName(record)}.hdr`);
  }, []);

  return (
    <Card bordered={false}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} wrap>
          <Upload accept={ENVIRONMENT_MAP_ACCEPT} customRequest={uploadEnvironmentMap} showUploadList={false}>
            <Button type="primary" loading={uploading}>
              Upload HDRI
            </Button>
          </Upload>
          <Input.Search
            allowClear
            placeholder="Search HDRI"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => {
              setKeyword(value);
              loadRecords(1, pagination.pageSize, value);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={records}
          pagination={pagination}
          onChange={(nextPagination) => {
            loadRecords(nextPagination.current || 1, nextPagination.pageSize || pagination.pageSize);
          }}
          columns={[
            {
              title: 'Preview',
              dataIndex: 'preview',
              width: 180,
              render: (_, record: EnvironmentMapRecord) => (
                <EnvironmentMapPreview
                  environmentMap={getEnvironmentMapRecordAttachment(record)}
                  emptyText="No HDRI"
                  height={72}
                />
              ),
            },
            {
              title: 'Title',
              dataIndex: 'title',
              render: (_, record: EnvironmentMapRecord) => getEnvironmentMapRecordDisplayName(record),
            },
            {
              title: 'Filename',
              dataIndex: ['attachment', 'filename'],
              render: (_, record: EnvironmentMapRecord) => getEnvironmentMapRecordAttachment(record)?.filename || '',
            },
            {
              title: 'Size',
              dataIndex: ['attachment', 'size'],
              width: 120,
              render: (_, record: EnvironmentMapRecord) => formatFileSize(getEnvironmentMapRecordAttachment(record)?.size),
            },
            {
              title: 'Created at',
              dataIndex: 'createdAt',
              width: 180,
            },
            {
              title: 'Actions',
              dataIndex: 'actions',
              width: 160,
              render: (_, record: EnvironmentMapRecord) => (
                <Space>
                  <Button type="link" onClick={() => downloadEnvironmentMap(record)}>
                    Download
                  </Button>
                  <Popconfirm
                    title="Delete this HDRI?"
                    description="3D files using this HDRI will return to the default environment."
                    onConfirm={() => deleteEnvironmentMap(record)}
                  >
                    <Button danger type="link">
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
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
