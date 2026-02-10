import { jsPDF } from 'jspdf';
import { fromHTML } from './fromHTML';
import { FromHTMLSettings, Margins, FontDefinition } from './types';
import { registerCustomFonts, clearCustomFonts } from './utils/fonts';

/** Default page margin in jsPDF units (mm by default) */
const DEFAULT_MARGIN = 10;

/**
 * Converts HTML DOM element to PDF Blob
 * Modern API wrapper around fromHTML
 * @param element - DOM element to convert
 * @param options - Optional settings
 * @returns Promise that resolves with PDF Blob
 */
export async function htmlToPdf(
  element: HTMLElement,
  options?: {
    /** Horizontal start position (overrides margin.left) */
    x?: number;
    /** Vertical start position (overrides margin.top) */
    y?: number;
    /** Content width (auto-calculated from margins if omitted) */
    width?: number;
    /**
     * Page margin. A single number applies to all sides.
     * An object allows per-side control; omitted sides default to `DEFAULT_MARGIN` (10).
     */
    margin?: number | { top?: number; bottom?: number; left?: number; right?: number };
    /** @deprecated Use `margin` instead. Kept for backward compatibility. */
    margins?: Margins;
    /** Custom fonts to embed in the PDF. Each entry registers a .ttf font with jsPDF. */
    fonts?: FontDefinition[];
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();

      // Register custom fonts with jsPDF
      if (options?.fonts?.length) {
        const fontMap: Record<string, string> = {};
        for (const font of options.fonts) {
          const pdfFontName = font.family.toLowerCase().replace(/\s+/g, '-');
          const style = font.style || 'normal';
          const filename = `${pdfFontName}-${style}.ttf`;
          doc.addFileToVFS(filename, font.src);
          doc.addFont(filename, pdfFontName, style);
          fontMap[font.family.toLowerCase()] = pdfFontName;
        }
        registerCustomFonts(fontMap);
      }

      // Resolve margins: options.margin > options.margins > defaults
      let top = DEFAULT_MARGIN;
      let bottom = DEFAULT_MARGIN;
      let left = DEFAULT_MARGIN;
      let right = DEFAULT_MARGIN;

      if (options?.margin !== undefined) {
        if (typeof options.margin === 'number') {
          top = bottom = left = right = options.margin;
        } else {
          top = options.margin.top ?? DEFAULT_MARGIN;
          bottom = options.margin.bottom ?? DEFAULT_MARGIN;
          left = options.margin.left ?? DEFAULT_MARGIN;
          right = options.margin.right ?? DEFAULT_MARGIN;
        }
      } else if (options?.margins) {
        top = options.margins.top;
        bottom = options.margins.bottom;
        left = options.margins.left ?? DEFAULT_MARGIN;
        right = options.margins.right ?? DEFAULT_MARGIN;
      }

      const x = options?.x ?? left;
      const y = options?.y ?? top;
      const pageWidth = doc.internal.pageSize.getWidth();
      const width = options?.width ?? pageWidth - left - right;

      fromHTML(
        doc,
        element,
        x,
        y,
        {
          width,
        },
        () => {
          clearCustomFonts();
          const blob = doc.output('blob');
          resolve(blob);
        },
        { top, bottom, left, right }
      );
    } catch (error) {
      clearCustomFonts();
      reject(error);
    }
  });
}

// Export the main fromHTML API (ported from old plugin)
export { fromHTML };

// Export types
export type { FromHTMLSettings, Margins, FontDefinition, ElementHandlers, ElementHandler } from './types';

// Export Renderer for advanced usage
export { Renderer } from './renderer/Renderer';

// Export font utilities
export { woffToTtf } from './utils/woff';
