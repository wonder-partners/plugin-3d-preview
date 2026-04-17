import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Typography, message } from 'antd';
import { useAPIClient } from '@nocobase/client';
import { SETTINGS_RESOURCE } from '../constants';
import type { EnvironmentMapStorageSettings, StorageOption } from '../types';
import {
  getDefaultStorageName,
  normalizeStorageOptions,
  normalizeStorageSettings,
} from '../utils/environmentMapStorage';

export function EnvironmentMapStorageSettingsPage() {
  const api = useAPIClient();
  const [storages, setStorages] = useState<StorageOption[]>([]);
  const [settings, setSettings] = useState<EnvironmentMapStorageSettings | null>(null);
  const [selectedStorageName, setSelectedStorageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    try {
      const [storagesResponse, settingsResponse] = await Promise.all([
        api.request({
          url: `${SETTINGS_RESOURCE}:listStorages`,
          method: 'get',
        }),
        api.request({
          url: `${SETTINGS_RESOURCE}:getEnvironmentMapStorage`,
          method: 'get',
        }),
      ]);
      const storagesPayload = storagesResponse?.data?.data ?? storagesResponse?.data;
      const settingsPayload = settingsResponse?.data?.data ?? settingsResponse?.data;
      const nextStorages = normalizeStorageOptions(storagesPayload);
      const nextSettings = normalizeStorageSettings(settingsPayload);

      setStorages(nextStorages);
      setSettings(nextSettings);
      setSelectedStorageName(nextSettings?.storageName || getDefaultStorageName(nextStorages));
    } catch (error) {
      message.error('Unable to load HDRI storage settings');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    setSaving(true);

    try {
      const response = await api.request({
        url: `${SETTINGS_RESOURCE}:setEnvironmentMapStorage`,
        method: 'post',
        data: {
          storageName: selectedStorageName,
        },
      });

      setSettings(normalizeStorageSettings(response?.data?.data ?? response?.data));
      message.success('HDRI storage settings saved');
    } catch (error: any) {
      if (error?.response?.status === 400) {
        message.error('Selected storage is not available');
      } else {
        message.error('Unable to save HDRI storage settings');
      }
    } finally {
      setSaving(false);
    }
  }, [api, selectedStorageName]);

  const options = useMemo(() => {
    const storageOptions = storages.map((storage) => ({
      value: storage.name,
      label: `${storage.title || storage.name}${storage.default ? ' (default)' : ''}`,
    }));

    if (settings?.missingStorageName) {
      storageOptions.unshift({
        value: settings.missingStorageName,
        label: `${settings.missingStorageName} (missing)`,
      });
    }

    return storageOptions;
  }, [settings?.missingStorageName, storages]);

  const currentValue = selectedStorageName || getDefaultStorageName(storages);

  return (
    <Card bordered={false} loading={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 720 }}>
        <Space direction="vertical" size={4}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            HDRI storage
          </Typography.Title>
          <Typography.Text type="secondary">
            Choose where new HDRI environment maps are stored. Existing HDRI files stay where they are.
          </Typography.Text>
        </Space>

        {settings?.missingStorageName ? (
          <Alert
            type="warning"
            showIcon
            message="Configured storage is no longer available"
            description={`New HDRI uploads will use ${settings.effectiveStorageTitle || 'the File Manager default storage'} until another storage is selected.`}
          />
        ) : null}

        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>Storage</Typography.Text>
          <Select
            value={currentValue}
            loading={loading}
            options={options}
            style={{ width: '100%' }}
            onChange={(value) => setSelectedStorageName(value)}
          />
        </Space>

        <Button type="primary" loading={saving} onClick={saveSettings}>
          Save
        </Button>
      </Space>
    </Card>
  );
}
