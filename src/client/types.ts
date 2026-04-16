import React from 'react';

export type File = {
  id?: string | number;
  url: string;
  title: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
};

export type Attachment = {
  id: string | number;
  title?: string;
  filename?: string;
  extname?: string;
  mimetype?: string;
  size?: number;
  url?: string;
};

export type EnvironmentMap = Attachment;

export type EnvironmentMapRecord = {
  id: string | number;
  title?: string;
  attachmentId?: string | number;
  attachment?: Attachment;
  createdAt?: string;
  updatedAt?: string;
};

export type PreviewerProps = {
  index: number;
  list: File[];
  onSwitchIndex: (index: number | null) => void;
};

export type ThumbnailProps = {
  file: File;
};

export type ModelViewerProps = {
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

export type EnvironmentMapModalProps = {
  file: File;
  open: boolean;
  environmentMap: EnvironmentMap | null;
  onClose: () => void;
  onSaved: (environmentMap: EnvironmentMap | null) => void;
};
