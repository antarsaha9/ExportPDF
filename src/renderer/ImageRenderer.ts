import { Renderer } from './Renderer';
import { getCSS } from '../parser/cssParser';
import { ParsedCSS } from '../types';

function parseRgbTriplet(color: string): { r: number; g: number; b: number } | null {
  const m = color.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (!m) return null;
  return { r: Math.round(Number(m[1])), g: Math.round(Number(m[2])), b: Math.round(Number(m[3])) };
}

function parsePx(value: string): number {
  const n = parseFloat(value || '');
  return Number.isFinite(n) ? n : 0;
}

function drawBrokenImagePlaceholder(
  renderer: Renderer,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  // Light gray box with an X
  renderer.pdf.setDrawColor(160, 160, 160);
  renderer.pdf.setLineWidth(0.5);
  renderer.pdf.rect(x, y, w, h);
  renderer.pdf.line(x, y, x + w, y + h);
  renderer.pdf.line(x + w, y, x, y + h);
}

/**
 * Renders an image element with floating support
 * Ported from old plugin's image rendering logic
 */
export function renderImage(
  imgElement: HTMLImageElement,
  renderer: Renderer,
  imagesCache: Record<string, HTMLImageElement | string>
): void {
  const url = imgElement.getAttribute('src');
  if (!url) return;

  // Get cached image - try hash code first, then direct URL
  const hashKey = (renderer.pdf as any).sHashCode ? (renderer.pdf as any).sHashCode(url) : null;
  const cachedImage = (hashKey && imagesCache[hashKey]) || imagesCache[url];
  const imagesCSS = getCSS(imgElement);
  const parentCSS = imgElement.parentElement ? getCSS(imgElement.parentElement) : (imagesCSS as ParsedCSS);

  const pageHeight = renderer.pdf.internal.pageSize.getHeight();
  const margins = (renderer.pdf as any).margins_doc || { top: 0, bottom: 0 };
  
  // Convert CSS px -> jsPDF units.
  // 1px = 0.75pt at 96dpi, and jsPDF internal unit uses scaleFactor pts per unit.
  const pxToUnit = 0.75 / renderer.pdf.internal.scaleFactor;

  // For images, use real computed px values for spacing (margins/padding/borders),
  // instead of the older "multiplier" conversion used for text layout.
  const computed = getComputedStyle(imgElement);
  const marginLeftPx = parsePx(computed.marginLeft);
  const marginRightPx = parsePx(computed.marginRight);
  const marginTopPx = parsePx(computed.marginTop);
  const marginBottomPx = parsePx(computed.marginBottom);
  const paddingLeftPx = parsePx(computed.paddingLeft);
  const paddingRightPx = parsePx(computed.paddingRight);
  const paddingTopPx = parsePx(computed.paddingTop);
  const paddingBottomPx = parsePx(computed.paddingBottom);

  // Calculate additional space from margins and padding (in jsPDF units)
  const additionalSpaceLeft = (marginLeftPx + paddingLeftPx) * pxToUnit;
  const additionalSpaceRight = (marginRightPx + paddingRightPx) * pxToUnit;
  const additionalSpaceTop = (marginTopPx + paddingTopPx) * pxToUnit;
  const additionalSpaceBottom = (marginBottomPx + paddingBottomPx) * pxToUnit;

  const naturalWidthPx =
    imgElement.naturalWidth ||
    (cachedImage as any)?.naturalWidth ||
    (typeof cachedImage !== 'string' ? (cachedImage as HTMLImageElement | undefined)?.width : undefined) ||
    100;
  const naturalHeightPx =
    imgElement.naturalHeight ||
    (cachedImage as any)?.naturalHeight ||
    (typeof cachedImage !== 'string' ? (cachedImage as HTMLImageElement | undefined)?.height : undefined) ||
    100;

  // Determine target image size. Preserve aspect ratio when only one dimension is defined
  // and when scaling down to fit the available width.
  const cssWidthPx = imagesCSS.width || 0;
  const cssHeightPx = imagesCSS.height || 0;
  const attrWidthPx = imgElement.width || 0;
  const attrHeightPx = imgElement.height || 0;
  const aspect = naturalHeightPx > 0 ? naturalWidthPx / naturalHeightPx : 1;

  // Priority: CSS width/height (computed) > HTML attributes > natural size
  let imgWidthPx = cssWidthPx || attrWidthPx || naturalWidthPx || 100;
  let imgHeightPx = cssHeightPx || attrHeightPx || naturalHeightPx || 100;

  // Preserve aspect ratio when only one dimension is specified
  if ((cssWidthPx || attrWidthPx) && !(cssHeightPx || attrHeightPx) && aspect > 0) {
    imgHeightPx = imgWidthPx / aspect;
  } else if (!(cssWidthPx || attrWidthPx) && (cssHeightPx || attrHeightPx) && aspect > 0) {
    imgWidthPx = imgHeightPx * aspect;
  } else if (!(cssWidthPx || attrWidthPx) && !(cssHeightPx || attrHeightPx)) {
    imgWidthPx = naturalWidthPx || 100;
    imgHeightPx = naturalHeightPx || 100;
  }

  // Convert to jsPDF units for layout + rendering
  let imgWidth = imgWidthPx * pxToUnit;
  let imgHeight = imgHeightPx * pxToUnit;

  // Fit-to-width scaling while maintaining aspect ratio
  const availableWidth =
    Math.max(renderer.settings.width - additionalSpaceLeft - additionalSpaceRight, 10);
  if (imgWidth > availableWidth && imgWidth > 0) {
    const scale = availableWidth / imgWidth;
    imgWidth = availableWidth;
    imgHeight = imgHeight * scale;
  }

  // Check for page break (including margins/padding)
  const requiredHeight = imgHeight + additionalSpaceTop + additionalSpaceBottom;
  if (
    pageHeight - margins.bottom < renderer.y + requiredHeight &&
    renderer.y > margins.top
  ) {
    renderer.pdf.addPage();
    renderer.y = margins.top;
    // Execute watch functions for new page
    renderer.executeWatchFunctions(imgElement);
  }

  // Calculate image X position (float + alignment)
  let imageX = renderer.x;
  const contentWidth = imgWidth + additionalSpaceLeft + additionalSpaceRight;
  const align = parentCSS['text-align'] || imagesCSS['text-align'] || 'left';

  if (imagesCSS['float'] === 'right') {
    imageX += renderer.settings.width - contentWidth + additionalSpaceLeft;
  } else if (imagesCSS['float'] === 'left') {
    imageX += additionalSpaceLeft;
  } else {
    // No float: use parent text-align for left/center/right
    if (align === 'center') {
      imageX += (renderer.settings.width - contentWidth) / 2 + additionalSpaceLeft;
    } else if (align === 'right') {
      imageX += renderer.settings.width - contentWidth + additionalSpaceLeft;
    } else {
      imageX += additionalSpaceLeft;
    }
  }

  const imageY = renderer.y + additionalSpaceTop;

  // Render image
  try {
    if (!cachedImage) {
      console.warn(`Image not loaded: ${url}`);
      drawBrokenImagePlaceholder(renderer, imageX, imageY, imgWidth, imgHeight);
    } else {
      if (typeof cachedImage === 'string') {
        renderer.pdf.addImage(cachedImage, 'PNG', imageX, imageY, imgWidth, imgHeight);
      } else {
        renderer.pdf.addImage(cachedImage, imageX, imageY, imgWidth, imgHeight);
      }
    }
  } catch (error) {
    console.warn('Failed to add image to PDF:', error);
    drawBrokenImagePlaceholder(renderer, imageX, imageY, imgWidth, imgHeight);
  }

  // Render border (basic) if present
  const borderStyle = computed.borderTopStyle || 'none';
  const borderWidthPx = parsePx(computed.borderTopWidth);
  const borderColor = computed.borderTopColor || imagesCSS['border-color'] || 'rgb(0,0,0)';
  if (borderStyle !== 'none' && borderWidthPx > 0) {
    const borderRgb = parseRgbTriplet(borderColor) || { r: 0, g: 0, b: 0 };
    renderer.pdf.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
    renderer.pdf.setLineWidth(borderWidthPx * pxToUnit || 0.5);
    renderer.pdf.rect(imageX, imageY, imgWidth, imgHeight);
  }

  // Handle floating
  if (imagesCSS['float'] === 'right' || imagesCSS['float'] === 'left') {
    const thresholdY =
      renderer.y + imgHeight + additionalSpaceTop + additionalSpaceBottom;
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
    const initialPages = (renderer.pdf.internal as any).getNumberOfPages?.() || 1;
    renderer.watchFunctions.push(
      (function (yPositionAfterFloating: number, pages: number, el?: Node) {
        if (
          renderer.y < yPositionAfterFloating &&
          pages === ((renderer.pdf.internal as any).getNumberOfPages?.() || pages)
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
      }).bind(null, renderer.y + imgHeight, initialPages)
    );

    // Adjust available width and X position for floating
    renderer.settings.width -= diffWidth;
    if (imagesCSS['float'] === 'left') {
      renderer.x += diffWidth;
    }
  } else {
    // No floating: move cursor down after image
    renderer.y += imgHeight + additionalSpaceTop + additionalSpaceBottom;
  }
}
