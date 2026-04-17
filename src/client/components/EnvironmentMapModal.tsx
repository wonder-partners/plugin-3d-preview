import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message, Modal, Select, Space, Typography, Upload } from 'antd';
import { saveAs } from 'file-saver';
import { useAPIClient } from '@nocobase/client';
import { ENVIRONMENT_MAP_ACCEPT, ENVIRONMENT_MAPS_RESOURCE, FILE_SETTINGS_RESOURCE } from '../constants';
import type { EnvironmentMapModalProps, EnvironmentMapRecord } from '../types';
import { setCachedEnvironmentMap, invalidateEnvironmentMapCache } from '../hooks/useEnvironmentMap';
import { getFileId, resolveUrl } from '../utils/files';
import {
  getDisplayName,
  getEnvironmentMapRecordAttachment,
  getEnvironmentMapRecordDisplayName,
} from '../utils/environmentMaps';
import { normalizeEnvironmentMapListResponse, uploadEnvironmentMapFile } from '../utils/environmentMapApi';
import { EnvironmentMapPreview } from './EnvironmentMapPreview';

export function EnvironmentMapModal({ file, open, environmentMap, onClose, onSaved }: EnvironmentMapModalProps) {
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
        setMaps(normalizeEnvironmentMapListResponse(response).records);
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
        const environmentMapRecord = await uploadEnvironmentMapFile(api, options.file);
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

  const downloadCurrentEnvironmentMap = useCallback(() => {
    const url = resolveUrl(environmentMap?.url);

    if (!url) {
      message.error('Unable to download environment map');
      return;
    }

    saveAs(url, environmentMap?.filename || `${getDisplayName(environmentMap)}.hdr`);
  }, [environmentMap]);

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
          <Space wrap>
            <Upload accept={ENVIRONMENT_MAP_ACCEPT} customRequest={uploadEnvironmentMap} showUploadList={false}>
              <Button loading={uploading}>Upload environment map</Button>
            </Upload>
            <Button disabled={!environmentMap} onClick={downloadCurrentEnvironmentMap}>
              Download current HDRI
            </Button>
          </Space>
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
