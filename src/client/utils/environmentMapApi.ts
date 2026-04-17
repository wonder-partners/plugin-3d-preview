import { ENVIRONMENT_MAPS_RESOURCE } from '../constants';
import type { EnvironmentMapRecord } from '../types';

type ApiClient = {
  request: (options: any) => Promise<any>;
};

export function normalizeEnvironmentMapListResponse(response: any): {
  records: EnvironmentMapRecord[];
  meta: Record<string, any>;
} {
  const body = response?.data ?? response;
  const payload = Array.isArray(body?.data) || body?.meta ? body : body?.data || body;
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

  return {
    records,
    meta: payload?.meta || body?.meta || {},
  };
}

export function normalizeEnvironmentMapRecordResponse(response: any): EnvironmentMapRecord | null {
  const body = response?.data ?? response;
  const payload = body?.data ?? body;
  const record = payload?.id ? payload : payload?.data;

  return record?.id ? record : null;
}

export async function uploadEnvironmentMapFile(api: ApiClient, file: File | Blob): Promise<EnvironmentMapRecord> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.request({
    url: `${ENVIRONMENT_MAPS_RESOURCE}:upload`,
    method: 'post',
    data: formData,
  });
  const environmentMapRecord = normalizeEnvironmentMapRecordResponse(response);

  if (!environmentMapRecord?.id) {
    throw new Error('Upload response did not include an environment map id');
  }

  return environmentMapRecord;
}
