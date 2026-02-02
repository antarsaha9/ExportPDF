/**
 * Converts CSS color to PDF color string
 * Handles #RRGGBB, rgb(), rgba(), and CSS color names
 * Ported from old plugin's getPdfColor function
 */

/**
 * RGB color helper class (simplified version)
 * In the old plugin, this was an external RGBColor library
 */
class RGBColor {
  r: number = 0;
  g: number = 0;
  b: number = 0;
  ok: boolean = false;

  constructor(color: string) {
    // Handle rgb() and rgba()
    const rgbMatch = color.match(/rgb\s*\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      this.r = parseInt(rgbMatch[1]);
      this.g = parseInt(rgbMatch[2]);
      this.b = parseInt(rgbMatch[3]);
      this.ok = true;
      return;
    }

    // Handle hex colors
    if (color.charAt(0) === '#') {
      let hex = color.substring(1);
      
      // Expand shorthand (#RGB -> #RRGGBB)
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      
      if (hex.length === 6) {
        this.r = parseInt(hex.substring(0, 2), 16);
        this.g = parseInt(hex.substring(2, 4), 16);
        this.b = parseInt(hex.substring(4, 6), 16);
        this.ok = true;
        return;
      }
    }

    // Handle CSS color names
    const colorNames: Record<string, string> = {
      black: '#000000',
      white: '#FFFFFF',
      red: '#FF0000',
      green: '#008000',
      blue: '#0000FF',
      yellow: '#FFFF00',
      cyan: '#00FFFF',
      magenta: '#FF00FF',
      gray: '#808080',
      grey: '#808080',
      orange: '#FFA500',
      purple: '#800080',
      pink: '#FFC0CB',
      brown: '#A52A2A',
    };

    const lowerColor = color.toLowerCase();
    if (colorNames[lowerColor]) {
      const hex = colorNames[lowerColor].substring(1);
      this.r = parseInt(hex.substring(0, 2), 16);
      this.g = parseInt(hex.substring(2, 4), 16);
      this.b = parseInt(hex.substring(4, 6), 16);
      this.ok = true;
      return;
    }
  }

  toHex(): string {
    const r = this.r.toString(16).padStart(2, '0');
    const g = this.g.toString(16).padStart(2, '0');
    const b = this.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
}

/**
 * Parses a CSS color string into r, g, b values (0-255).
 * Returns null if parsing fails.
 */
export function parseRGB(cssColor: string): { r: number; g: number; b: number } | null {
  const color = new RGBColor(cssColor);
  if (color.ok) {
    return { r: color.r, g: color.g, b: color.b };
  }
  return null;
}

/**
 * Formats a number to 3 decimal places
 */
function f3(number: number): string {
  return number.toFixed(3);
}

/**
 * Converts CSS color string to PDF color command
 * Returns PDF color string like "0.000 g" (gray) or "0.000 0.000 0.000 rg" (RGB)
 */
export function getPdfColor(cssColor: string): string {
  let r: any, g: any, b: any;

  // Handle rgb() format
  const rgbMatch = cssColor.match(/rgb\s*\(\s*(\d+),\s*(\d+),\s*(\d+\s*)\)/);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1]);
    g = parseInt(rgbMatch[2]);
    b = parseInt(rgbMatch[3]);
  } else {
    // Use RGBColor helper
    const rgbColor = new RGBColor(cssColor);
    
    if (rgbColor.ok) {
      cssColor = rgbColor.toHex();
    } else {
      cssColor = '#000000'; // Default to black
    }

    // Parse hex color
    if (cssColor.charAt(0) === '#') {
      const hex = cssColor.substring(1);
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      // Fallback
      r = 0;
      g = 0;
      b = 0;
    }
  }

  // Handle edge case where r might be a hex string
  if (typeof r === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r)) {
    const hex = parseInt(r.substr(1), 16);
    r = (hex >> 16) & 255;
    g = (hex >> 8) & 255;
    b = hex & 255;
  }

  // Generate PDF color command
  if ((r === 0 && g === 0 && b === 0) || typeof g === 'undefined') {
    // Gray scale
    return f3(r / 255) + ' g';
  } else {
    // RGB
    return [f3(r / 255), f3(g / 255), f3(b / 255), 'rg'].join(' ');
  }
}
