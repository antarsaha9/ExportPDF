import { jsPDF } from 'jspdf';
import { fromHTML } from './fromHTML';
import { FromHTMLSettings, Margins } from './types';

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
    x?: number;
    y?: number;
    width?: number;
    margins?: Margins;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      
      fromHTML(
        doc,
        element,
        options?.x,
        options?.y,
        {
          width: options?.width,
        },
        () => {
          const blob = doc.output('blob');
          resolve(blob);
        },
        options?.margins
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Export the main fromHTML API (ported from old plugin)
export { fromHTML };

// Export types
export type { FromHTMLSettings, Margins, ElementHandlers, ElementHandler } from './types';

// Export Renderer for advanced usage
export { Renderer } from './renderer/Renderer';
