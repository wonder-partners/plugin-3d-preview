import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        'field-of-view'?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        'shadow-intensity'?: string;
        'tone-mapping'?: string;
        exposure?: string;
        'shadow-softness'?: string;
        'rotation-per-second'?: string;
        'interaction-prompt'?: string;
        'disable-zoom'?: boolean;
      };
      'effect-composer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'ssao-effect': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        strength?: number | 2;
      };
      'smaa-effect': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
      };
    }
  }
}
