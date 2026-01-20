import { parseElement, TextNode } from './htmlParser';
import { createPdfFromNodes, pdfToBlob } from './pdfGenerator';

/**
 * Converts HTML DOM element to PDF Blob
 * @param element - DOM element to convert
 * @returns Promise that resolves with PDF Blob
 */
export async function htmlToPdf(element: HTMLElement): Promise<Blob> {
  // Parse DOM element to extract text nodes
  const nodes: TextNode[] = parseElement(element);

  // Create PDF from text nodes (await for image loading)
  const doc = await createPdfFromNodes(nodes);

  // Convert PDF to Blob
  return pdfToBlob(doc);
}

// Export types and utilities
export type { TextNode } from './htmlParser';
export { parseElement, extractAllText } from './htmlParser';
export { createPdfFromNodes, pdfToBlob } from './pdfGenerator';
