import React, { useCallback, useEffect, useRef } from 'react';
import '@google/model-viewer';
import { assignRef } from '../utils/files';
import type { ModelViewerProps } from '../types';

export function ModelViewer({
  url,
  title,
  environmentImage,
  viewerRef,
  fieldOfView,
  cameraControls,
  autoRotate,
  rotationPerSecond,
  interactionPrompt,
  disableZoom,
  toneMapping,
  children,
}: ModelViewerProps) {
  const internalViewerRef = useRef<HTMLElement | null>(null);

  const setViewerRef = useCallback(
    (node: HTMLElement | null) => {
      internalViewerRef.current = node;
      assignRef(viewerRef, node);
    },
    [viewerRef],
  );

  useEffect(() => {
    const viewer = internalViewerRef.current;
    if (!viewer) {
      return;
    }

    const handleLoad = () => {
      const toneMapping = viewer.getAttribute('tone-mapping');
      if (!toneMapping) {
        return;
      }

      // Replay the tone-mapping attribute mutation after load
      // to force correct application on the initial render.
      viewer.removeAttribute('tone-mapping');
      requestAnimationFrame(() => {
        viewer.setAttribute('tone-mapping', toneMapping);
      });
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [url]);

  return (
    <model-viewer
      key={`${url}:${environmentImage || 'default'}`}
      ref={setViewerRef}
      src={url}
      alt={title}
      field-of-view={fieldOfView}
      camera-controls={cameraControls}
      auto-rotate={autoRotate}
      rotation-per-second={rotationPerSecond}
      interaction-prompt={interactionPrompt}
      disable-zoom={disableZoom}
      tone-mapping={toneMapping}
      environment-image={environmentImage || undefined}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </model-viewer>
  );
}
