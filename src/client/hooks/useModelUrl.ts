import { useMemo } from 'react';
import type { File } from '../types';
import { resolveUrl } from '../utils/files';

export function useModelUrl(file: File) {
  return useMemo(() => resolveUrl(file.url), [file.url]);
}
