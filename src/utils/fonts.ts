/**
 * Font name database mapping CSS font names to jsPDF font names
 */
const FontNameDB: Record<string, string> = {
  helvetica: 'helvetica',
  'sans-serif': 'helvetica',
  'times new roman': 'times',
  serif: 'times',
  times: 'times',
  monospace: 'courier',
  courier: 'courier',
};

/**
 * Font weight mapping
 */
const FontWeightMap: Record<string | number, string> = {
  100: 'normal',
  200: 'normal',
  300: 'normal',
  400: 'normal',
  500: 'bold',
  600: 'bold',
  700: 'bold',
  800: 'bold',
  900: 'bold',
  normal: 'normal',
  bold: 'bold',
  bolder: 'bold',
  lighter: 'normal',
};

/**
 * Font style mapping
 */
const FontStyleMap: Record<string, string> = {
  normal: 'normal',
  italic: 'italic',
  oblique: 'italic',
};

/**
 * Resolves CSS font-family string to jsPDF font name
 * Handles font fallbacks (e.g., "Arial, Helvetica, sans-serif")
 * Ported from old plugin's ResolveFont function
 */
export function resolveFont(cssFontFamily: string): string {
  if (!cssFontFamily) return 'times';

  const parts = cssFontFamily.split(',');
  let part = parts.shift();

  while (part) {
    const name = FontNameDB[part.trim().toLowerCase()];
    if (name) {
      return name;
    }
    part = parts.shift();
  }

  return 'times'; // Default fallback
}

/**
 * Resolves font weight to normal or bold
 */
export function resolveFontWeight(weight: string | number): string {
  return FontWeightMap[weight] || 'normal';
}

/**
 * Resolves font style to normal or italic
 */
export function resolveFontStyle(style: string): string {
  return FontStyleMap[style] || 'normal';
}

/**
 * Combines font weight and style for jsPDF
 */
export function combineFontStyle(weight: string, style: string): string {
  if (weight === 'bold') {
    if (style === 'normal') {
      return 'bold';
    } else {
      return weight + style;
    }
  }
  return style;
}
