import { Renderer } from './Renderer';
import { getCSS } from '../parser/cssParser';

/**
 * List counter (shared across list rendering)
 */
let listCount = 1;

/**
 * Resets list counter (call before rendering a new ordered list)
 */
export function resetListCounter(): void {
  listCount = 1;
}

/**
 * Gets and increments list counter for ordered lists
 */
export function getNextListNumber(): number {
  return listCount++;
}

/**
 * Renders bullet point for unordered list items
 * Ported from old plugin - bullet is drawn relative to text position
 * x, y should be the text rendering position
 */
export function renderBulletPoint(
  liElement: HTMLLIElement,
  renderer: Renderer,
  x: number,
  y: number
): void {
  const liCSS = getCSS(liElement);
  // fontSize is a multiplier (e.g., 1.0 = default), not absolute size
  const fontSize = liCSS['font-size'] || 1;
  
  // Calculate offsets relative to text position (x, y)
  // These calculations match the old plugin exactly
  // offsetX moves bullet left from text position
  // offsetY moves bullet down to align with text baseline
  const offsetX = (3 - fontSize * 0.75) * renderer.pdf.internal.scaleFactor;
  const offsetY = fontSize * 0.75 * renderer.pdf.internal.scaleFactor;
  const radius = (fontSize * 1.74) / renderer.pdf.internal.scaleFactor;
  
  // Calculate final bullet position
  const bulletX = x + offsetX;
  const bulletY = y + offsetY;
  
  // Ensure radius is reasonable (not too small or negative)
  const finalRadius = radius > 0 && radius <= 10 ? radius : 2 / renderer.pdf.internal.scaleFactor;
  
  // Draw bullet circle
  renderer.pdf.setFillColor(0, 0, 0);
  renderer.pdf.circle(bulletX, bulletY, finalRadius, 'F');
}
