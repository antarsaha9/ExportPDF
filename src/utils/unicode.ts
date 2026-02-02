/**
 * Normalizes Unicode characters that are not supported by jsPDF's
 * built-in fonts (WinAnsiEncoding) to their safe ASCII equivalents.
 *
 * Without this, characters like curly quotes cause incorrect glyph
 * width lookups, resulting in extra spacing or missing glyphs in
 * the generated PDF.
 */

const UNICODE_MAP: Record<string, string> = {
  // Quotation marks
  '\u2018': "'",  // left single curly quote
  '\u2019': "'",  // right single curly quote / apostrophe
  '\u201A': "'",  // single low-9 quotation mark
  '\u201B': "'",  // single high-reversed-9 quotation mark
  '\u201C': '"',  // left double curly quote
  '\u201D': '"',  // right double curly quote
  '\u201E': '"',  // double low-9 quotation mark
  '\u201F': '"',  // double high-reversed-9 quotation mark
  '\u2039': "'",  // single left-pointing angle quotation
  '\u203A': "'",  // single right-pointing angle quotation
  '\u00AB': '"',  // left-pointing double angle quotation (guillemet)
  '\u00BB': '"',  // right-pointing double angle quotation (guillemet)

  // Dashes and hyphens
  '\u2013': '-',  // en dash
  '\u2014': '--', // em dash
  '\u2015': '--', // horizontal bar
  '\u2012': '-',  // figure dash
  '\u2010': '-',  // hyphen
  '\u2011': '-',  // non-breaking hyphen

  // Spaces
  '\u00A0': ' ',  // non-breaking space
  '\u2002': ' ',  // en space
  '\u2003': ' ',  // em space
  '\u2004': ' ',  // three-per-em space
  '\u2005': ' ',  // four-per-em space
  '\u2006': ' ',  // six-per-em space
  '\u2007': ' ',  // figure space
  '\u2008': ' ',  // punctuation space
  '\u2009': ' ',  // thin space
  '\u200A': ' ',  // hair space
  '\u202F': ' ',  // narrow no-break space
  '\u205F': ' ',  // medium mathematical space

  // Dots and ellipsis
  '\u2026': '...', // horizontal ellipsis
  '\u2024': '.',   // one dot leader
  '\u2025': '..',  // two dot leader

  // Other common symbols
  '\u2022': '-',  // bullet
  '\u2023': '>',  // triangular bullet
  '\u2043': '-',  // hyphen bullet
  '\u2027': '-',  // hyphenation point
  '\u2032': "'",  // prime
  '\u2033': '"',  // double prime
  '\u2034': "'''",// triple prime
  '\u2035': "'",  // reversed prime
  '\u2036': '"',  // reversed double prime

  // Copyright, trademark, registered
  '\u00A9': '(c)',  // ©
  '\u00AE': '(R)',  // ®
  '\u2122': '(TM)', // ™

  // Currency
  '\u20AC': 'EUR',  // €
  '\u00A3': 'GBP',  // £
  '\u00A5': 'JPY',  // ¥

  // Superscript digits
  '\u00B2': '2',    // ²
  '\u00B3': '3',    // ³
  '\u00B9': '1',    // ¹

  // Math symbols
  '\u03C0': 'pi',   // π
  '\u2248': '~=',   // ≈
  '\u2211': 'sum',  // ∑
  '\u222B': 'int',  // ∫
  '\u221A': 'sqrt', // √
  '\u2260': '!=',   // ≠
  '\u2264': '<=',   // ≤
  '\u2265': '>=',   // ≥
  '\u00B1': '+/-',  // ±
  '\u00D7': 'x',    // ×
  '\u00F7': '/',    // ÷
  '\u221E': 'inf',  // ∞
  '\u2202': 'd',    // ∂

  // Common emoji → text fallbacks
  '\u2705': '[check]',  // ✅
  '\u274C': '[x]',      // ❌
  '\u26A0': '[!]',      // ⚠
  '\uFE0F': '',         // variation selector-16 (emoji modifier, remove)
  '\u{1F600}': ':)',     // 😀
  '\u{1F389}': '[party]',// 🎉
  '\u{1F4C4}': '[doc]', // 📄

  // Zero-width and invisible characters (remove entirely)
  '\u200B': '',   // zero-width space
  '\u200C': '',   // zero-width non-joiner
  '\u200D': '',   // zero-width joiner
  '\uFEFF': '',   // byte order mark / zero-width no-break space
};

// Build regex from map keys
// Separate single BMP characters (can go in character class) from multi-char/astral sequences (need alternation)
const bmpChars: string[] = [];
const astralSequences: string[] = [];
for (const key of Object.keys(UNICODE_MAP)) {
  if (key.length === 1) {
    bmpChars.push(key);
  } else {
    // Astral plane characters (surrogate pairs) or multi-char keys
    astralSequences.push(key);
  }
}
const bmpPart = bmpChars.length > 0 ? '[' + bmpChars.join('') + ']' : '';
const astralPart = astralSequences.length > 0 ? astralSequences.join('|') : '';
const pattern = [bmpPart, astralPart].filter(Boolean).join('|');
const UNICODE_REGEX = new RegExp(pattern, 'gu');

/**
 * Replaces problematic Unicode characters with PDF-safe ASCII equivalents.
 */
export function normalizeUnicode(text: string): string {
  return text.replace(UNICODE_REGEX, (ch) => UNICODE_MAP[ch] ?? ch);
}
