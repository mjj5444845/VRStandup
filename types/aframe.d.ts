import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type AFrameElement = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Record<string, unknown>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a-asset-item': AFrameElement;
      'a-assets': AFrameElement;
      'a-box': AFrameElement;
      'a-camera': AFrameElement;
      'a-circle': AFrameElement;
      'a-cylinder': AFrameElement;
      'a-cursor': AFrameElement;
      'a-entity': AFrameElement;
      'a-obj-model': AFrameElement;
      'a-plane': AFrameElement;
      'a-ring': AFrameElement;
      'a-scene': AFrameElement;
      'a-sky': AFrameElement;
      'a-sphere': AFrameElement;
      'a-text': AFrameElement;
    }
  }
}

export {};
