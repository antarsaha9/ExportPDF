import { Renderer } from './Renderer';
import { ElementHandlers } from '../types';
import { drillForContent } from '../fromHTML';
import { getCSS } from '../parser/cssParser';

/**
 * Checks for footer element and sets up footer rendering
 * Ported from old plugin's checkForFooter function
 */
export function checkForFooter(
  element: HTMLElement,
  renderer: Renderer,
  elementHandlers: ElementHandlers
): void {
  const footers = element.getElementsByTagName('footer');
  if (footers.length === 0) {
    return;
  }

  const footer = footers[0] as HTMLElement;

  // Calculate footer height by doing a fake render
  const internal = renderer.pdf.internal as any;
  const oldOut = internal.write;
  const oldY = renderer.y;
  
  // Temporarily disable writing to calculate height
  internal.write = function () {};
  
  // Fake render to get height
  drillForContent(footer, renderer, elementHandlers);
  const footerHeight = Math.ceil(renderer.y - oldY) + 5;
  
  // Restore
  renderer.y = oldY;
  internal.write = oldOut;

  // Add footer height to bottom margin
  const margins = (renderer.pdf as any).margins_doc || { bottom: 0 };
  margins.bottom = (margins.bottom || 0) + footerHeight;

  // Function to render footer on each page
  const renderFooter = function (pageInfo?: any) {
    const pageNumber =
      pageInfo?.pageNumber || (renderer.pdf.internal as any).getNumberOfPages?.() || 1;
    const oldPosition = renderer.y;
    const pageHeight = renderer.pdf.internal.pageSize.getHeight();
    
    // Position at bottom
    renderer.y = pageHeight - margins.bottom;
    margins.bottom -= footerHeight;

    // Handle page number placeholders
    const spans = footer.getElementsByTagName('span');
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const className = (' ' + span.className + ' ').replace(/[\n\t]/g, ' ');
      
      // Page counter
      if (className.indexOf(' pageCounter ') > -1) {
        span.textContent = pageNumber.toString();
      }
      
      // Total pages (will be replaced later)
      if (className.indexOf(' totalPages ') > -1) {
        span.textContent = '###jsPDFVarTotalPages###';
      }
    }

    // Render footer content
    drillForContent(footer, renderer, elementHandlers);
    
    // Restore margins and position
    margins.bottom += footerHeight;
    renderer.y = oldPosition;
  };

  // Check if footer needs total pages replacement
  const spans = footer.getElementsByTagName('span');
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const className = (' ' + span.className + ' ').replace(/[\n\t]/g, ' ');
    if (className.indexOf(' totalPages ') > -1) {
      // Subscribe to rendering finished event to replace total pages
      renderer.pdf.internal.events.subscribe(
        'htmlRenderingFinished',
        function () {
          const totalPages = (renderer.pdf.internal as any).getNumberOfPages?.() || 1;
          // Replace placeholder in all spans
          const allSpans = footer.getElementsByTagName('span');
          for (let j = 0; j < allSpans.length; j++) {
            if (allSpans[j].textContent === '###jsPDFVarTotalPages###') {
              allSpans[j].textContent = totalPages.toString();
            }
          }
        },
        true // once
      );
      break;
    }
  }

  // Subscribe to addPage event to render footer on each new page
  renderer.pdf.internal.events.subscribe('addPage', renderFooter, false);
  
  // Render footer on first page
  renderFooter();
}
