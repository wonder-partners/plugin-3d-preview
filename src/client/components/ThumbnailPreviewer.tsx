import React from 'react';
import type { ThumbnailProps } from '../types';
import { useEnvironmentMap } from '../hooks/useEnvironmentMap';
import { useModelUrl } from '../hooks/useModelUrl';
import { ModelViewer } from './ModelViewer';

export function ThumbnailPreviewer({ file }: ThumbnailProps) {
  const url = useModelUrl(file);
  const { environmentImage } = useEnvironmentMap(file);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ModelViewer
        url={url}
        title={file.title}
        environmentImage={environmentImage}
        autoRotate
        rotationPerSecond="30deg"
        interactionPrompt="none"
        disableZoom
        toneMapping="aces"
      />
    </div>
  );
}
