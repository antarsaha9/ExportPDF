import { Renderer } from './Renderer';
import { getCSS } from '../parser/cssParser';

/**
 * Renders an HR (horizontal rule) element
 */
export function renderHR(hrElement: HTMLElement, renderer: Renderer): void {
  const css = getCSS(hrElement);
  const pageWidth = renderer.pdf.internal.pageSize.getWidth();
  const margins = (renderer.pdf as any).margins_doc || { top: 0, bottom: 0 };
  
  // Determine left margin: use margins_doc.left if explicitly set, otherwise use initial X position
  // Store initial x if not already stored
  if (!(renderer.pdf as any).initialX) {
    (renderer.pdf as any).initialX = renderer.x;
  }
  const initialX = (renderer.pdf as any).initialX;
  const marginLeft = margins.left !== undefined ? margins.left : initialX;
  // Right margin should match left margin if not explicitly set (symmetrical margins)
  // This ensures HR doesn't extend beyond the right edge
  const marginRight = margins.right !== undefined ? margins.right : marginLeft;
  
  // Calculate spacing
  const fontToUnitRatio = 12 / renderer.pdf.internal.scaleFactor;
  const marginTop = (css['margin-top'] || 0) * fontToUnitRatio;
  const marginBottom = (css['margin-bottom'] || 0) * fontToUnitRatio;
  
  // Add top margin
  renderer.y += marginTop;
  
  // Check for page break
  const pageHeight = renderer.pdf.internal.pageSize.getHeight();
  const marginsDoc = (renderer.pdf as any).margins_doc || { top: 0, bottom: 0 };
  if (renderer.y + marginBottom > pageHeight - marginsDoc.bottom) {
    renderer.pdf.addPage();
    renderer.y = marginsDoc.top || 0;
  }
  
  // Draw horizontal line
  // Use left margin as starting position (not renderer.x, which might have moved)
  const xStart = marginLeft;
  const xEnd = pageWidth - marginRight;
  
  // Get border color and width from CSS
  const borderColor = css['color'] || 'rgb(200,200,200)';
  const borderWidth = 0.5; // Default line width
  
  renderer.pdf.setDrawColor(200, 200, 200); // Default gray
  renderer.pdf.setLineWidth(borderWidth);
  renderer.pdf.line(xStart, renderer.y, xEnd, renderer.y);
  
  // Add bottom margin
  renderer.y += marginBottom + 5; // Add small spacing
}


/**
 * Renders pre/code elements with monospace font
 * Note: This modifies the CSS to use monospace font
 */
export function renderPreCode(
  element: HTMLElement,
  renderer: Renderer,
  isPre: boolean
): void {
  const css = getCSS(element);
  
  // Force monospace font for pre/code
  css['font-family'] = 'courier';
  
  // Pre elements typically preserve whitespace and have different styling
  if (isPre) {
    // Pre elements often have background color and padding
    const fontToUnitRatio = 12 / renderer.pdf.internal.scaleFactor;
    const marginTop = (css['margin-top'] || 0) * fontToUnitRatio;
    const marginBottom = (css['margin-bottom'] || 0) * fontToUnitRatio;
    const padding = (css['padding-left'] || css['padding-top'] || 0) * fontToUnitRatio;
    
    renderer.y += marginTop;
    
    // Draw background if specified
    const backgroundColor = css['color'] || undefined; // Note: color might be used for background in some cases
    // Background rendering would go here if needed
    
    // Add padding
    const tempX = renderer.x;
    renderer.x += padding;
    
    // Content will be rendered by drillForContent with modified CSS
    // After rendering, reset X
    // renderer.x = tempX; // This will be handled by block boundary
    
    renderer.y += marginBottom;
  }
  
  // Code elements are typically inline, so they're handled differently
  // The CSS modification will ensure monospace font is used
}
