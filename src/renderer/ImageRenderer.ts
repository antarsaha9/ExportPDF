import { Renderer } from './Renderer';
import { getCSS } from '../parser/cssParser';
import { ParsedCSS } from '../types';

/**
 * Renders an image element with floating support
 * Ported from old plugin's image rendering logic
 */
export function renderImage(
  imgElement: HTMLImageElement,
  renderer: Renderer,
  imagesCache: Record<string, HTMLImageElement>
): void {
  const url = imgElement.getAttribute('src');
  if (!url) return;

  // Get cached image - try hash code first, then direct URL
  const hashKey = (renderer.pdf as any).sHashCode ? (renderer.pdf as any).sHashCode(url) : null;
  const cachedImage = (hashKey && imagesCache[hashKey]) || imagesCache[url];
  if (!cachedImage) {
    console.warn(`Image not loaded: ${url}`);
    return;
  }

  const pageHeight = renderer.pdf.internal.pageSize.getHeight();
  const margins = (renderer.pdf as any).margins_doc || { top: 0, bottom: 0 };
  
  // Check for page break
  const imgHeight = imgElement.height || (cachedImage as HTMLImageElement).height || 100;
  if (
    pageHeight - margins.bottom < renderer.y + imgHeight &&
    renderer.y > margins.top
  ) {
    renderer.pdf.addPage();
    renderer.y = margins.top;
    // Execute watch functions for new page
    renderer.executeWatchFunctions(imgElement);
  }

  const imagesCSS = getCSS(imgElement);
  const fontToUnitRatio = 12 / renderer.pdf.internal.scaleFactor;

  // Calculate additional space from margins and padding
  const additionalSpaceLeft =
    (imagesCSS['margin-left'] + imagesCSS['padding-left']) * fontToUnitRatio;
  const additionalSpaceRight =
    (imagesCSS['margin-right'] + imagesCSS['padding-right']) * fontToUnitRatio;
  const additionalSpaceTop =
    (imagesCSS['margin-top'] + imagesCSS['padding-top']) * fontToUnitRatio;
  const additionalSpaceBottom =
    (imagesCSS['margin-bottom'] + imagesCSS['padding-bottom']) * fontToUnitRatio;

  // Calculate image X position
  let imageX = renderer.x;
  if (imagesCSS['float'] === 'right') {
    // Float right: position at right edge
    const imgWidth = imgElement.width || (cachedImage as HTMLImageElement).width || 100;
    imageX += renderer.settings.width - imgWidth - additionalSpaceRight;
  } else {
    // Default or float left: position at left with margin
    imageX += additionalSpaceLeft;
  }

  const imgWidth = imgElement.width || (cachedImage as HTMLImageElement).width || 100;
  const imgHeightFinal = imgElement.height || (cachedImage as HTMLImageElement).height || 100;

  // Render image
  try {
    renderer.pdf.addImage(
      cachedImage,
      imageX,
      renderer.y + additionalSpaceTop,
      imgWidth,
      imgHeightFinal
    );
  } catch (error) {
    console.warn('Failed to add image to PDF:', error);
    return;
  }

  // Handle floating
  if (imagesCSS['float'] === 'right' || imagesCSS['float'] === 'left') {
    const thresholdY =
      renderer.y + imgHeightFinal + additionalSpaceTop + additionalSpaceBottom;
    const diffWidth = imgWidth + additionalSpaceLeft + additionalSpaceRight;

    // Watch function to restore coordinates after floating
    renderer.watchFunctions.push(
      (function (
        diffX: number,
        thresholdY: number,
        diffWidth: number,
        el?: Node
      ) {
        // Undo drawing box adaptations set by floating
        if (renderer.y >= thresholdY) {
          renderer.x += diffX;
          renderer.settings.width += diffWidth;
          return true;
        } else if (
          el &&
          el.nodeType === Node.ELEMENT_NODE
        ) {
          const elWidth = (el as HTMLElement).offsetWidth || 0;
          const pageWidth = renderer.pdf.internal.pageSize.getWidth();
          const margins = (renderer.pdf as any).margins_doc || {};
          const maxX = (margins.left || 0) + (margins.width || pageWidth);
          
          if (renderer.x + elWidth > maxX) {
            renderer.x += diffX;
            renderer.y = thresholdY;
            renderer.settings.width += diffWidth;
            return true;
          }
        }
        return false;
      }).bind(
        null,
        imagesCSS['float'] === 'left'
          ? -(imgWidth + additionalSpaceLeft + additionalSpaceRight)
          : 0,
        thresholdY,
        diffWidth
      )
    );

    // Watch function to handle clear:both
    const initialPages = renderer.pdf.internal.getNumberOfPages();
    renderer.watchFunctions.push(
      (function (yPositionAfterFloating: number, pages: number, el?: Node) {
        if (
          renderer.y < yPositionAfterFloating &&
          pages === renderer.pdf.internal.getNumberOfPages()
        ) {
          if (
            el &&
            el.nodeType === Node.ELEMENT_NODE
          ) {
            const elCSS = getCSS(el as HTMLElement);
            if (elCSS.clear === 'both') {
              renderer.y = yPositionAfterFloating;
              return true;
            }
          }
          return false;
        }
        return true;
      }).bind(null, renderer.y + imgHeightFinal, initialPages)
    );

    // Adjust available width and X position for floating
    renderer.settings.width -= diffWidth;
    if (imagesCSS['float'] === 'left') {
      renderer.x += diffWidth;
    }
  } else {
    // No floating: move cursor down after image
    renderer.y += imgHeightFinal + additionalSpaceTop + additionalSpaceBottom;
  }
}
