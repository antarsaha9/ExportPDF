import { Renderer } from './Renderer';
import { getCSS } from '../parser/cssParser';
import { ParsedCSS } from '../types';

function extractFirstUrl(backgroundImage: string): string | null {
  // Handles: url("..."), url('...'), url(...)
  const m = backgroundImage.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
  return m && m[2] ? m[2] : null;
}

/**
 * Very basic background-image renderer.
 *
 * Limitations:
 * - Only draws the first url() if multiple backgrounds are provided
 * - Uses element offsetWidth/offsetHeight; if unavailable, falls back to renderer width and skips height
 * - Scales image to fill the element box (no repeat/position/size semantics yet)
 */
export function renderBackgroundImage(
  element: HTMLElement,
  renderer: Renderer,
  imagesCache: Record<string, HTMLImageElement | string>
): void {
  const css: ParsedCSS = getCSS(element);
  const bg = css['background-image'] || 'none';
  if (!bg || bg === 'none') return;

  const url = extractFirstUrl(bg);
  if (!url) return;

  const hashKey = (renderer.pdf as any).sHashCode ? (renderer.pdf as any).sHashCode(url) : null;
  const cachedImage = (hashKey && imagesCache[hashKey]) || imagesCache[url];
  if (!cachedImage) {
    // Best-effort: background image might not be preloaded, so skip silently.
    return;
  }

  // Convert px -> PDF units (approx; same value used in fromHTML)
  const px2pt = 0.264583 * 72 / 25.4;
  const boxW =
    (element.offsetWidth ? element.offsetWidth * px2pt : renderer.settings.width) || renderer.settings.width;
  const boxH = element.offsetHeight ? element.offsetHeight * px2pt : 0;
  if (boxW <= 0 || boxH <= 0) return;

  const x = renderer.x;
  const y = renderer.y;

  try {
    if (typeof cachedImage === 'string') {
      renderer.pdf.addImage(cachedImage, 'PNG', x, y, boxW, boxH);
    } else {
      renderer.pdf.addImage(cachedImage, x, y, boxW, boxH);
    }
  } catch {
    // If jsPDF can't render it, ignore.
  }
}

