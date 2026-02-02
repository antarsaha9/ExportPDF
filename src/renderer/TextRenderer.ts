import { jsPDF } from 'jspdf';
import { ParsedCSS, Paragraph, TextLine } from '../types';
import { purgeWhitespace } from '../utils/whitespace';
import { getPdfColor } from '../utils/colors';

/**
 * Default font size in points
 */
const DEFAULT_FONT_SIZE = 12;

/**
 * Clones an object
 */
function clone<T>(obj: T): T {
  return Object.assign({}, obj);
}

/**
 * Splits text fragments into lines based on available width
 * Ported from old plugin's splitFragmentsIntoLines function
 */
export function splitFragmentsIntoLines(
  pdf: jsPDF,
  fragments: string[],
  styles: ParsedCSS[],
  maxLineLength: number
): TextLine[] {
  const k = pdf.internal.scaleFactor;
  const fontMetricsCache: Record<string, any> = {};
  let ff: string | undefined;
  let fs: string | undefined;
  let fontMetrics: any;
  let fragment: string | undefined;
  let fragmentSpecificMetrics: any;
  let fragmentLength: number;
  let fragmentChopped: string[];
  let style: ParsedCSS | undefined;

  let line: TextLine = [];
  const lines: TextLine[] = [line];
  let currentLineLength = 0;

  while (fragments.length) {
    fragment = fragments.shift();
    style = styles.shift();

    if (fragment) {
      ff = style!['font-family'];
      fs = style!['font-style'];
      fontMetrics = fontMetricsCache[ff + fs];

      if (!fontMetrics) {
        const font = (pdf.internal as any).getFont(ff, fs);
        fontMetrics = font.metadata?.Unicode || font.metadata;
        fontMetricsCache[ff + fs] = fontMetrics;
      }

      fragmentSpecificMetrics = {
        widths: fontMetrics.widths,
        kerning: fontMetrics.kerning,
        fontSize: style!['font-size'] * DEFAULT_FONT_SIZE,
        textIndent: currentLineLength,
      };

      fragmentLength =
        (pdf.getStringUnitWidth(fragment, fragmentSpecificMetrics) *
          fragmentSpecificMetrics.fontSize) /
        k;

      if (fragment === '\u2028') {
        // Line break
        line = [];
        lines.push(line);
        currentLineLength = 0;
      } else if (currentLineLength + fragmentLength > maxLineLength) {
        // Need to split fragment
        fragmentChopped = pdf.splitTextToSize(
          fragment,
          maxLineLength,
          fragmentSpecificMetrics
        );
        line.push([fragmentChopped.shift()!, style!]);
        while (fragmentChopped.length) {
          line = [[fragmentChopped.shift()!, style!]];
          lines.push(line);
        }
        if (line.length > 0) {
          const lastFragment = line[0][0];
          currentLineLength =
            (pdf.getStringUnitWidth(lastFragment, fragmentSpecificMetrics) *
              fragmentSpecificMetrics.fontSize) /
            k;
        } else {
          currentLineLength = 0;
        }
      } else {
        // Fragment fits on current line
        line.push([fragment, style!]);
        currentLineLength += fragmentLength;
      }
    }
  }

  // Apply text alignment
  if (style && style['text-align'] !== undefined) {
    const align = style['text-align'];
    if (align === 'center' || align === 'right' || align === 'justify') {
      for (let i = 0; i < lines.length; i++) {
        const lineFragments = lines[i];
        if (lineFragments.length === 0) continue;

        // Calculate total line width
        const firstFragment = lineFragments[0];
        const firstStyle = firstFragment[1];
        ff = firstStyle['font-family'];
        fs = firstStyle['font-style'];
        fontMetrics = fontMetricsCache[ff + fs] || (pdf.internal as any).getFont(ff, fs).metadata?.Unicode;

        fragmentSpecificMetrics = {
          widths: fontMetrics.widths,
          kerning: fontMetrics.kerning,
          fontSize: firstStyle['font-size'] * DEFAULT_FONT_SIZE,
        };

        let lineText = '';
        for (const frag of lineFragments) {
          lineText += frag[0];
        }
        const length =
          (pdf.getStringUnitWidth(lineText, fragmentSpecificMetrics) *
            fragmentSpecificMetrics.fontSize) /
          k;
        const space = maxLineLength - length;

        // Clone style if needed
        if (i > 0) {
          lineFragments[0][1] = clone(lineFragments[0][1]);
        }

        if (align === 'right') {
          lineFragments[0][1]['margin-left'] = space;
        } else if (align === 'center') {
          lineFragments[0][1]['margin-left'] = space / 2;
        } else if (align === 'justify') {
          const countSpaces = lineText.split(' ').length - 1;
          lineFragments[0][1]['word-spacing'] = countSpaces > 0 ? space / countSpaces : 0;
          // Ignore last line in justify mode
          if (i === lines.length - 1) {
            lineFragments[0][1]['word-spacing'] = 0;
          }
        }
      }
    }
  }

  return lines;
}

/**
 * Renders a text fragment
 * Ported from old plugin's RenderTextFragment function
 * Returns the updated y position
 */
export function renderTextFragment(
  pdf: jsPDF,
  text: string,
  style: ParsedCSS,
  x: number,
  y: number,
  pageHeight: number,
  margins: { top: number; bottom: number },
  lastTextColor: { value: string },
  rendererY?: { value: number } // Optional reference to renderer's y position
): number {
  const defaultFontSize = DEFAULT_FONT_SIZE;
  let currentY = y;

  // Note: Page break checking is now handled in renderParagraph before calling this function
  // So we don't need to check here to avoid double page breaks
  // This function just renders the text at the given position

  // Get font
  const font = (pdf.internal as any).getFont(style['font-family'], style['font-style']);

  // Set text color
  const pdfTextColor = getPdfColor(style.color);
  if (pdfTextColor !== lastTextColor.value) {
    const internal = pdf.internal as any;
    if (internal.write) {
      internal.write(pdfTextColor);
    } else {
      // Use public API - parse color and set
      const colorMatch = pdfTextColor.match(/([\d.]+)\s+([gr])/);
      if (colorMatch) {
        const value = parseFloat(colorMatch[1]) * 255;
        if (colorMatch[2] === 'g') {
          pdf.setTextColor(value, value, value);
        } else {
          // Would need RGB parsing
          pdf.setTextColor(0, 0, 0);
        }
      }
    }
    lastTextColor.value = pdfTextColor;
  }

  // Set word spacing for justify
  const internal = pdf.internal as any;
  if (style['word-spacing'] !== undefined && style['word-spacing'] > 0) {
    if (internal.write) {
      internal.write(style['word-spacing'].toFixed(2), 'Tw');
    }
    // Note: Public API doesn't support word spacing directly
  }

  // Render text
  if (internal.write) {
    internal.write(
      '/' + font.id,
      (defaultFontSize * style['font-size']).toFixed(2),
      'Tf',
      '(' + (pdf.internal as any).pdfEscape(text, {}) + ') Tj'
    );
  } else {
    pdf.setFont(style['font-family'], style['font-style']);
    pdf.setFontSize(defaultFontSize * style['font-size']);
    pdf.text(text, x, currentY);
  }

  // Reset word spacing
  if (style['word-spacing'] !== undefined) {
    if (internal.write) {
      internal.write(0, 'Tw');
    }
  }
  
  return currentY;
}
