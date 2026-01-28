import { ParsedCSS } from '../types';
import { resolveFont, resolveFontWeight, resolveFontStyle } from '../utils/fonts';
import { resolveUnitedNumber } from '../utils/units';

/**
 * Text align mapping
 */
const TextAlignMap: Record<string, 'left' | 'right' | 'center' | 'justify'> = {
  left: 'left',
  right: 'right',
  center: 'center',
  justify: 'justify',
};

/**
 * Float mapping
 */
const FloatMap: Record<string, 'none' | 'left' | 'right'> = {
  none: 'none',
  right: 'right',
  left: 'left',
};

/**
 * Clear mapping
 */
const ClearMap: Record<string, 'none' | 'both'> = {
  none: 'none',
  both: 'both',
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
 * Gets computed CSS style for an element
 * Ported from old plugin's GetCSS function
 */
export function getCSS(element: HTMLElement): ParsedCSS {
  // Get computed style
  const computedCSSElement = getComputedStyleElement(element);

  const css: Partial<ParsedCSS> = {};

  // Font family
  css['font-family'] = resolveFont(computedCSSElement('font-family')) || 'times';

  // Font style
  css['font-style'] = FontStyleMap[computedCSSElement('font-style')] || 'normal';

  // Text align
  css['text-align'] = TextAlignMap[computedCSSElement('text-align')] || 'left';

  // Font weight
  let fontWeight = FontWeightMap[computedCSSElement('font-weight')] || 'normal';
  const fontStyleValue = FontStyleMap[computedCSSElement('font-style')] || 'normal';
  
  // Combine font weight and style properly
  if (fontWeight === 'bold') {
    if (fontStyleValue === 'normal') {
      css['font-style'] = 'bold';
    } else if (fontStyleValue === 'italic') {
      css['font-style'] = 'bolditalic'; // Combined bold and italic
    } else {
      css['font-style'] = fontWeight + fontStyleValue;
    }
  } else {
    css['font-style'] = fontStyleValue;
  }

  // Font size and line height
  css['font-size'] = resolveUnitedNumber(computedCSSElement('font-size')) || 1;
  css['line-height'] = resolveUnitedNumber(computedCSSElement('line-height')) || 1;

  // Display
  css['display'] = computedCSSElement('display') === 'inline' ? 'inline' : 'block';

  // Margins and padding (only for block elements)
  const isBlock = css['display'] === 'block';
  css['margin-top'] = isBlock ? resolveUnitedNumber(computedCSSElement('margin-top')) || 0 : 0;
  css['margin-bottom'] = isBlock ? resolveUnitedNumber(computedCSSElement('margin-bottom')) || 0 : 0;
  css['padding-top'] = isBlock ? resolveUnitedNumber(computedCSSElement('padding-top')) || 0 : 0;
  css['padding-bottom'] = isBlock ? resolveUnitedNumber(computedCSSElement('padding-bottom')) || 0 : 0;
  css['margin-left'] = isBlock ? resolveUnitedNumber(computedCSSElement('margin-left')) || 0 : 0;
  css['margin-right'] = isBlock ? resolveUnitedNumber(computedCSSElement('margin-right')) || 0 : 0;
  css['padding-left'] = isBlock ? resolveUnitedNumber(computedCSSElement('padding-left')) || 0 : 0;
  css['padding-right'] = isBlock ? resolveUnitedNumber(computedCSSElement('padding-right')) || 0 : 0;

  // Word spacing (used for justify)
  css['word-spacing'] = 0;

  // Width/height (use raw computed px values; 0 if 'auto' or empty)
  // These are especially important for <img> sizing.
  const widthStr = computedCSSElement('width') || '0px';
  const heightStr = computedCSSElement('height') || '0px';
  css.width = widthStr === 'auto' ? 0 : Math.max(0, parseFloat(widthStr) || 0);
  css.height = heightStr === 'auto' ? 0 : Math.max(0, parseFloat(heightStr) || 0);

  // Border + background (basic)
  // Border width/color/style are useful for image borders and block decorations.
  css['border-width'] = resolveUnitedNumber(computedCSSElement('border-top-width')) || 0;
  css['border-color'] = computedCSSElement('border-top-color') || 'rgb(0,0,0)';
  css['border-style'] = computedCSSElement('border-top-style') || 'none';
  css['background-image'] = computedCSSElement('background-image') || 'none';

  // Page break
  css['page-break-before'] = computedCSSElement('page-break-before') || 'auto';

  // Float and clear
  css['float'] = FloatMap[computedCSSElement('cssFloat')] || 'none';
  css['clear'] = ClearMap[computedCSSElement('clear')] || 'none';

  // Color
  css['color'] = computedCSSElement('color');

  return css as ParsedCSS;
}

/**
 * Gets computed style element helper
 * Handles browser differences (getComputedStyle vs currentStyle)
 */
function getComputedStyleElement(element: HTMLElement): (prop: string) => string {
  let compCSS: CSSStyleDeclaration | any;

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    compCSS = window.getComputedStyle(element, null);
  } else if ((element as any).currentStyle) {
    compCSS = (element as any).currentStyle;
  } else {
    compCSS = element.style;
  }

  return function (prop: string): string {
    // Convert kebab-case to camelCase
    const camelProp = prop.replace(/-([a-z])/g, (match) => match.charAt(1).toUpperCase());
    return compCSS[prop] || compCSS[camelProp] || '';
  };
}
