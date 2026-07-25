import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCodeStyling, { type Options } from 'qr-code-styling';
import Box from '@mui/material/Box';

export interface QrCodeCanvasHandle {
  /** Downloads the current code as a PNG with the given filename (no extension). */
  download: (filename: string) => Promise<void>;
}

interface QrCodeCanvasProps {
  /** Full qr-code-styling options; `width`/`height` should stay high-res (see EXPORT_SIZE). */
  options: Partial<Options>;
  /** CSS pixel size the (vector) preview is displayed at. */
  previewSize: number;
}

/**
 * Thin imperative wrapper around qr-code-styling, which manipulates the DOM
 * directly rather than rendering declaratively. The instance is created once
 * and mutated via `.update()` on every style change, so restyling never
 * flickers or remounts the DOM node.
 */
export const QrCodeCanvas = forwardRef<QrCodeCanvasHandle, QrCodeCanvasProps>(
  function QrCodeCanvas({ options, previewSize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<QRCodeStyling | null>(null);
    const latestOptions = useRef(options);
    latestOptions.current = options;

    useEffect(() => {
      const instance = new QRCodeStyling(latestOptions.current);
      instanceRef.current = instance;
      if (containerRef.current) instance.append(containerRef.current);
      return () => {
        if (containerRef.current) containerRef.current.innerHTML = '';
        instanceRef.current = null;
      };
      // Instantiate once; subsequent style changes go through `.update()` below
      // so the underlying SVG/canvas node is mutated in place, not remounted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      instanceRef.current?.update(options);
    }, [options]);

    useImperativeHandle(ref, () => ({
      download: async (filename: string) => {
        await instanceRef.current?.download({ name: filename, extension: 'png' });
      },
    }));

    return (
      <Box
        ref={containerRef}
        sx={{
          lineHeight: 0,
          '& svg': { width: previewSize, height: previewSize, display: 'block' },
        }}
      />
    );
  },
);
