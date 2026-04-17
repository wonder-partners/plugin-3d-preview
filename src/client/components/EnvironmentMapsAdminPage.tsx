import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, message, Popconfirm, Space, Table, Upload } from 'antd';
import { saveAs } from 'file-saver';
import { useAPIClient } from '@nocobase/client';
import { ENVIRONMENT_MAP_ACCEPT, ENVIRONMENT_MAPS_RESOURCE } from '../constants';
import type { EnvironmentMapRecord } from '../types';
import { invalidateEnvironmentMapCache } from '../hooks/useEnvironmentMap';
import { formatDateTime, formatFileSize, resolveUrl } from '../utils/files';
import {
  getEnvironmentMapRecordAttachment,
  getEnvironmentMapRecordDisplayName,
} from '../utils/environmentMaps';
import { normalizeEnvironmentMapListResponse, uploadEnvironmentMapFile } from '../utils/environmentMapApi';
import { EnvironmentMapPreview } from './EnvironmentMapPreview';

export function EnvironmentMapsAdminPage() {
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
        const { records: rows, meta } = normalizeEnvironmentMapListResponse(response);

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
        const environmentMapRecord = await uploadEnvironmentMapFile(api, options.file);
        options.onSuccess?.(environmentMapRecord);
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
              render: (value: string) => formatDateTime(value),
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
