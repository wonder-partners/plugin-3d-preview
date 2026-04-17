import { ENVIRONMENT_MAPS_RESOURCE } from '../constants';
import type { EnvironmentMapRecord } from '../types';

type ApiClient = {
  request: (options: any) => Promise<any>;
};

export async function uploadEnvironmentMapFile(api: ApiClient, file: File | Blob): Promise<EnvironmentMapRecord> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.request({
    url: `${ENVIRONMENT_MAPS_RESOURCE}:upload`,
    method: 'post',
    data: formData,
  });
  const environmentMapRecord = response?.data?.data;

  if (!environmentMapRecord?.id) {
    throw new Error('Upload response did not include an environment map id');
  }

  return environmentMapRecord;
}
