/**
 * CSS parsing utilities to extract computed styles from DOM elements
 * Extracts font properties, colors, spacing, and layout information
 */

export interface ParsedCSS {
  fontFamily: string;
  fontSize: number; // in points (pt)
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string; // RGB color string like "rgb(0,0,0)" or hex "#000000"
  textAlign: 'left' | 'right' | 'center' | 'justify';
  lineHeight: number; // multiplier (e.g., 1.5 means 1.5x font size)
  marginTop: number; // in points
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  paddingTop: number; // in points
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  display: 'block' | 'inline' | 'inline-block' | 'none';
  backgroundColor?: string; // RGB color string
}

/**
 * Font family mapping from CSS font names to jsPDF font names
 */
const FONT_NAME_DB: Record<string, string> = {
  'helvetica': 'helvetica',
  'arial': 'helvetica',
  'sans-serif': 'helvetica',
  'times': 'times',
  'times new roman': 'times',
  'serif': 'times',
  'courier': 'courier',
  'courier new': 'courier',
  'monospace': 'courier',
};

/**
 * Font weight mapping
 */
const FONT_WEIGHT_MAP: Record<string | number, 'normal' | 'bold'> = {
  100: 'normal',
  200: 'normal',
  300: 'normal',
  400: 'normal',
  500: 'bold',
  600: 'bold',
  700: 'bold',
  800: 'bold',
  900: 'bold',
  'normal': 'normal',
  'bold': 'bold',
  'bolder': 'bold',
  'lighter': 'normal',
};

/**
 * Font style mapping
 */
const FONT_STYLE_MAP: Record<string, 'normal' | 'italic'> = {
  'normal': 'normal',
  'italic': 'italic',
  'oblique': 'italic',
};

/**
 * Text align mapping
 */
const TEXT_ALIGN_MAP: Record<string, 'left' | 'right' | 'center' | 'justify'> = {
  'left': 'left',
  'right': 'right',
  'center': 'center',
  'justify': 'justify',
};

/**
 * Converts CSS font-family string to jsPDF font name
 * Handles font fallbacks (e.g., "Arial, Helvetica, sans-serif")
 */
function resolveFontFamily(cssFontFamily: string): string {
  if (!cssFontFamily) return 'helvetica';
  
  const parts = cssFontFamily.split(',').map(p => p.trim().toLowerCase());
  
  for (const part of parts) {
    // Remove quotes if present
    const cleanPart = part.replace(/['"]/g, '');
    if (FONT_NAME_DB[cleanPart]) {
      return FONT_NAME_DB[cleanPart];
    }
  }
  
  return 'helvetica'; // Default fallback
}

/**
 * Converts CSS size values (px, pt, em, rem) to points
 * Default base font size is 16px = 12pt
 */
function resolveSizeToPoints(cssSize: string, baseFontSize: number = 12): number {
  if (!cssSize || cssSize === 'auto' || cssSize === 'normal') {
    return baseFontSize;
  }
  
  // Handle em/rem units (relative to base font size)
  if (cssSize.includes('em')) {
    const value = parseFloat(cssSize.replace('em', ''));
    if (!isNaN(value)) {
      return value * baseFontSize;
    }
  }
  
  if (cssSize.includes('rem')) {
    const value = parseFloat(cssSize.replace('rem', ''));
    if (!isNaN(value)) {
      return value * 12; // rem is relative to root (typically 16px = 12pt)
    }
  }
  
  // Handle px units (1px ≈ 0.75pt)
  if (cssSize.includes('px')) {
    const value = parseFloat(cssSize.replace('px', ''));
    if (!isNaN(value)) {
      return value * 0.75;
    }
  }
  
  // Handle pt units (already in points)
  if (cssSize.includes('pt')) {
    const value = parseFloat(cssSize.replace('pt', ''));
    if (!isNaN(value)) {
      return value;
    }
  }
  
  // Handle percentage
  if (cssSize.includes('%')) {
    const value = parseFloat(cssSize.replace('%', ''));
    if (!isNaN(value)) {
      return (value / 100) * baseFontSize;
    }
  }
  
  // Try to parse as number (assumes px)
  const numericValue = parseFloat(cssSize);
  if (!isNaN(numericValue)) {
    return numericValue * 0.75; // Assume px
  }
  
  return baseFontSize; // Default fallback
}

/**
 * Converts CSS line-height to a multiplier
 * Handles unitless numbers, px, pt, em, rem, percentages
 */
function resolveLineHeight(cssLineHeight: string, fontSize: number): number {
  if (!cssLineHeight || cssLineHeight === 'auto' || cssLineHeight === 'normal') {
    return 1.05; // Very tight default line height
  }
  
  // Unitless number (e.g., "1.5")
  const unitlessMatch = cssLineHeight.match(/^[\d.]+$/);
  if (unitlessMatch) {
    const value = parseFloat(cssLineHeight);
    // Cap line-height aggressively (max 1.15 for unitless)
    return Math.min(value, 1.15);
  }
  
  // Convert to points first, then divide by font size to get multiplier
  const lineHeightInPoints = resolveSizeToPoints(cssLineHeight, fontSize);
  const multiplier = lineHeightInPoints / fontSize;
  // Cap multiplier at 1.15 for tighter spacing
  return Math.min(multiplier, 1.15);
}

/**
 * Converts CSS color to RGB string format "rgb(r,g,b)"
 * Handles hex (#RRGGBB), rgb(), rgba(), and CSS color names
 */
function resolveColor(cssColor: string): string {
  if (!cssColor) return 'rgb(0,0,0)'; // Default black
  
  // Remove whitespace
  cssColor = cssColor.trim();
  
  // Handle rgb() and rgba()
  const rgbMatch = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return `rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`;
  }
  
  // Handle hex colors (#RRGGBB or #RGB)
  if (cssColor.startsWith('#')) {
    let hex = cssColor.substring(1);
    
    // Expand shorthand (#RGB -> #RRGGBB)
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgb(${r},${g},${b})`;
    }
  }
  
  // Handle CSS color names (basic set)
  const colorNames: Record<string, string> = {
    'black': 'rgb(0,0,0)',
    'white': 'rgb(255,255,255)',
    'red': 'rgb(255,0,0)',
    'green': 'rgb(0,128,0)',
    'blue': 'rgb(0,0,255)',
    'yellow': 'rgb(255,255,0)',
    'cyan': 'rgb(0,255,255)',
    'magenta': 'rgb(255,0,255)',
    'gray': 'rgb(128,128,128)',
    'grey': 'rgb(128,128,128)',
    'orange': 'rgb(255,165,0)',
    'purple': 'rgb(128,0,128)',
    'pink': 'rgb(255,192,203)',
    'brown': 'rgb(165,42,42)',
  };
  
  const lowerColor = cssColor.toLowerCase();
  if (colorNames[lowerColor]) {
    return colorNames[lowerColor];
  }
  
  return 'rgb(0,0,0)'; // Default fallback to black
}

/**
 * Gets computed CSS style for an element
 * Uses browser's getComputedStyle API
 */
function getComputedStyleProperty(element: HTMLElement, property: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) {
    // Fallback for non-browser environments (shouldn't happen in this library)
    return '';
  }
  
  const computed = window.getComputedStyle(element);
  const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  return computed.getPropertyValue(property) || (computed as any)[camelProperty] || '';
}

/**
 * Parses computed CSS styles from a DOM element
 * Extracts all relevant styling information for PDF rendering
 */
export function parseComputedCSS(element: HTMLElement): ParsedCSS {
  // Get computed styles
  const fontFamily = getComputedStyleProperty(element, 'font-family');
  const fontSize = getComputedStyleProperty(element, 'font-size');
  const fontWeight = getComputedStyleProperty(element, 'font-weight');
  const fontStyle = getComputedStyleProperty(element, 'font-style');
  const color = getComputedStyleProperty(element, 'color');
  const textAlign = getComputedStyleProperty(element, 'text-align');
  const lineHeight = getComputedStyleProperty(element, 'line-height');
  const marginTop = getComputedStyleProperty(element, 'margin-top');
  const marginBottom = getComputedStyleProperty(element, 'margin-bottom');
  const marginLeft = getComputedStyleProperty(element, 'margin-left');
  const marginRight = getComputedStyleProperty(element, 'margin-right');
  const paddingTop = getComputedStyleProperty(element, 'padding-top');
  const paddingBottom = getComputedStyleProperty(element, 'padding-bottom');
  const paddingLeft = getComputedStyleProperty(element, 'padding-left');
  const paddingRight = getComputedStyleProperty(element, 'padding-right');
  const display = getComputedStyleProperty(element, 'display');
  const backgroundColor = getComputedStyleProperty(element, 'background-color');
  
  // Resolve font size (default to 12pt)
  const fontSizePt = resolveSizeToPoints(fontSize, 12);
  
  // Parse and return structured CSS
  return {
    fontFamily: resolveFontFamily(fontFamily),
    fontSize: fontSizePt,
    fontWeight: FONT_WEIGHT_MAP[fontWeight] || 'normal',
    fontStyle: FONT_STYLE_MAP[fontStyle] || 'normal',
    color: resolveColor(color),
    textAlign: TEXT_ALIGN_MAP[textAlign] || 'left',
    lineHeight: resolveLineHeight(lineHeight, fontSizePt),
    marginTop: resolveSizeToPoints(marginTop, fontSizePt),
    marginBottom: resolveSizeToPoints(marginBottom, fontSizePt),
    marginLeft: resolveSizeToPoints(marginLeft, fontSizePt),
    marginRight: resolveSizeToPoints(marginRight, fontSizePt),
    paddingTop: resolveSizeToPoints(paddingTop, fontSizePt),
    paddingBottom: resolveSizeToPoints(paddingBottom, fontSizePt),
    paddingLeft: resolveSizeToPoints(paddingLeft, fontSizePt),
    paddingRight: resolveSizeToPoints(paddingRight, fontSizePt),
    display: (display === 'inline' || display === 'inline-block') ? 'inline' : 'block',
    backgroundColor: backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)' 
      ? resolveColor(backgroundColor) 
      : undefined,
  };
}

/**
 * Extracts RGB values from rgb() string
 * @param rgbString - String like "rgb(255,0,0)"
 * @returns Object with r, g, b values (0-255)
 */
export function parseRGB(rgbString: string): { r: number; g: number; b: number } {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }
  return { r: 0, g: 0, b: 0 }; // Default to black
}
