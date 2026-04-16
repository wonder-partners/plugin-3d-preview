import React, { useEffect, useRef, useState } from 'react';
import { Typography } from 'antd';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { Attachment } from '../types';
import { resolveUrl } from '../utils/files';
import { getEnvironmentMapExtension } from '../utils/environmentMaps';

type EnvironmentMapPreviewProps = {
  environmentMap: Attachment | null;
  height?: number;
  emptyText?: string;
};

export function EnvironmentMapPreview({
  environmentMap,
  height = 140,
  emptyText = 'Select an environment map to preview it',
}: EnvironmentMapPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasState, setCanvasState] = useState<'idle' | 'loading' | 'error'>('idle');
  const previewUrl = resolveUrl(environmentMap?.url);
  const extension = getEnvironmentMapExtension(environmentMap);
  const isHdrImage = extension === 'hdr';

  useEffect(() => {
    if (!previewUrl || !isHdrImage) {
      setCanvasState('idle');
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let texture: THREE.Texture | null = null;
    let material: THREE.MeshBasicMaterial | null = null;
    let geometry: THREE.PlaneGeometry | null = null;

    const renderPreview = async () => {
      setCanvasState('loading');

      try {
        const bounds = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.floor(bounds.width || 480));
        const height = Math.max(1, Math.floor(bounds.height || 140));
        const loader = new RGBELoader();

        loader.setCrossOrigin('anonymous');
        texture = await loader.loadAsync(previewUrl);

        if (!active) {
          texture.dispose();
          return;
        }

        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        geometry = new THREE.PlaneGeometry(2, 2);
        material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        scene.add(new THREE.Mesh(geometry, material));
        renderer.render(scene, camera);
        setCanvasState('idle');
      } catch (error) {
        if (active) {
          setCanvasState('error');
        }
      }
    };

    renderPreview();

    return () => {
      active = false;
      texture?.dispose();
      material?.dispose();
      geometry?.dispose();
      renderer?.dispose();
    };
  }, [extension, height, isHdrImage, previewUrl]);

  if (!environmentMap || !previewUrl) {
    return (
      <div
        style={{
          alignItems: 'center',
          border: '1px dashed #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          height,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Typography.Text type="secondary">{emptyText}</Typography.Text>
      </div>
    );
  }

  if (!isHdrImage) {
    return (
      <div
        style={{
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          height,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Typography.Text type="secondary">Only .hdr files can be used as environment maps</Typography.Text>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#f5f5f5',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        height,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', height: '100%', width: '100%' }} />
      {canvasState !== 'idle' && (
        <div
          style={{
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.72)',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            position: 'absolute',
          }}
        >
          <Typography.Text type="secondary">
            {canvasState === 'loading' ? 'Loading preview' : 'Preview unavailable'}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}
