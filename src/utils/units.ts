/**
 * Cache for resolved unit values
 */
const UnitedNumberMap: Record<string, number> = {
  normal: 1,
};

/**
 * Default font size in points
 */
const DEFAULT_FONT_SIZE = 16.0;

/**
 * Converts CSS size values to a multiplier relative to default font size
 * Handles px, pt, em, rem, percentages, and named sizes
 * Ported from old plugin's ResolveUnitedNumber function
 */
export function resolveUnitedNumber(cssSize: string): number {
  // Handle IE8 issues - auto becomes 0px
  if (cssSize === 'auto') {
    cssSize = '0px';
  }

  // Convert em to px (assuming 1em = 18.719px based on old plugin)
  if (cssSize.indexOf('em') > -1 && !isNaN(Number(cssSize.replace('em', '')))) {
    cssSize = Number(cssSize.replace('em', '')) * 18.719 + 'px';
  }

  // Convert pt to px (1pt = 1.333px)
  if (cssSize.indexOf('pt') > -1 && !isNaN(Number(cssSize.replace('pt', '')))) {
    cssSize = Number(cssSize.replace('pt', '')) * 1.333 + 'px';
  }

  // Check cache
  const cached = UnitedNumberMap[cssSize];
  if (cached !== undefined) {
    return cached;
  }

  // Handle named sizes
  const namedSizes: Record<string, number> = {
    'xx-small': 9,
    'x-small': 11,
    small: 13,
    medium: 16,
    large: 19,
    'x-large': 23,
    'xx-large': 28,
    auto: 0,
  };

  const namedValue = namedSizes[cssSize];
  if (namedValue !== undefined) {
    return (UnitedNumberMap[cssSize] = namedValue / DEFAULT_FONT_SIZE);
  }

  // Handle numeric values (unitless)
  const numericValue = parseFloat(cssSize);
  if (!isNaN(numericValue)) {
    return (UnitedNumberMap[cssSize] = numericValue / DEFAULT_FONT_SIZE);
  }

  // Handle px values
  const pxMatch = cssSize.match(/([\d.]+)(px)/);
  if (pxMatch && pxMatch.length === 3) {
    return (UnitedNumberMap[cssSize] = parseFloat(pxMatch[1]) / DEFAULT_FONT_SIZE);
  }

  // Default fallback
  return (UnitedNumberMap[cssSize] = 1);
}
