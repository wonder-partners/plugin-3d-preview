import type { Attachment, EnvironmentMap, EnvironmentMapRecord } from '../types';

export function getDisplayName(file?: EnvironmentMap | null) {
  if (!file) {
    return 'Default';
  }

  return file.title || file.filename || `#${file.id}`;
}

export function getEnvironmentMapRecordAttachment(record?: EnvironmentMapRecord | null) {
  return record?.attachment || null;
}

export function getEnvironmentMapRecordDisplayName(record?: EnvironmentMapRecord | null) {
  if (!record) {
    return 'Default';
  }

  const attachment = getEnvironmentMapRecordAttachment(record);
  return record.title || attachment?.title || attachment?.filename || `#${record.id}`;
}

export function getEnvironmentMapExtension(file?: Attachment | null) {
  const extname = file?.extname;

  if (extname) {
    return String(extname).replace(/^\./, '').toLowerCase();
  }

  const source = file?.url || file?.filename || '';
  const parts = String(source).split('?')[0].split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function isHdrAttachment(file?: Attachment | null) {
  return getEnvironmentMapExtension(file) === 'hdr';
}
