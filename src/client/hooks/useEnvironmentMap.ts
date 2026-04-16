import { useEffect, useState } from 'react';
import { useAPIClient } from '@nocobase/client';
import { FILE_SETTINGS_RESOURCE } from '../constants';
import type { EnvironmentMap, File } from '../types';
import { getFileId, resolveUrl } from '../utils/files';

const environmentMapCache = new Map<string, EnvironmentMap | null>();
const environmentMapSubscribers = new Set<() => void>();
let environmentMapCacheRevision = 0;

function getCachedEnvironmentMap(fileId: string) {
  return environmentMapCache.has(fileId) ? environmentMapCache.get(fileId) : undefined;
}

export function setCachedEnvironmentMap(fileId: string, environmentMap: EnvironmentMap | null) {
  environmentMapCache.set(fileId, environmentMap);
  environmentMapSubscribers.forEach((listener) => listener());
}

export function invalidateEnvironmentMapCache() {
  environmentMapCache.clear();
  environmentMapCacheRevision += 1;
  environmentMapSubscribers.forEach((listener) => listener());
}

export function useEnvironmentMap(file: File) {
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
