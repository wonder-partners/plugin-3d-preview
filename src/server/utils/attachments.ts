import { ENVIRONMENT_MAP_EXTENSIONS } from '../constants';

export function getExtension(file: any) {
  const extname = file?.get?.('extname') || file?.extname;

  if (extname) {
    return String(extname).replace(/^\./, '').toLowerCase();
  }

  const url = file?.get?.('url') || file?.get?.('filename') || file?.url || file?.filename || '';
  const parts = String(url).split('?')[0].split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function serializeAttachment(file: any) {
  if (!file) {
    return null;
  }

  const data = typeof file.toJSON === 'function' ? file.toJSON() : file;

  return {
    id: data.id,
    title: data.title,
    filename: data.filename,
    extname: data.extname,
    mimetype: data.mimetype,
    size: data.size,
    url: data.url,
  };
}

export function throwHttpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  throw error;
}

export async function findAttachmentById(db: any, id: any, transaction?: any) {
  if (id === null || id === undefined || id === '') {
    return null;
  }

  return db.getRepository('attachments').findOne({
    filter: {
      id,
    },
    transaction,
  });
}

export async function findAttachment(ctx: any, id: any) {
  return findAttachmentById(ctx.db, id);
}

export async function assertAttachmentExtension(ctx: any, id: any, extensions: string[], message: string) {
  const attachment = await findAttachment(ctx, id);

  if (!attachment || !extensions.includes(getExtension(attachment))) {
    ctx.throw(400, message);
  }

  return attachment;
}

export async function assertHdrAttachmentId(db: any, attachmentId: any, transaction?: any) {
  if (!attachmentId) {
    throwHttpError(400, 'attachmentId is required');
  }

  const attachment = await findAttachmentById(db, attachmentId, transaction);

  if (!attachment) {
    throwHttpError(404, 'Attachment not found');
  }

  if (!ENVIRONMENT_MAP_EXTENSIONS.includes(getExtension(attachment))) {
    throwHttpError(400, 'Only .hdr files can be used as environment maps');
  }

  return attachment;
}
