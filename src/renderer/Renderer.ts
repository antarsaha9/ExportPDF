import { jsPDF } from 'jspdf';
import { ParsedCSS, Paragraph, WatchFunction, RendererSettings } from '../types';
import { getPdfColor } from '../utils/colors';
import { purgeWhitespace } from '../utils/whitespace';
import { splitFragmentsIntoLines, renderTextFragment } from './TextRenderer';
import { getCSS } from '../parser/cssParser';

/**
 * Renderer class manages PDF rendering state and coordinates
 * Ported from old plugin's Renderer class
 */
export class Renderer {
  public pdf: jsPDF;
  public x: number;
  public y: number;
  public settings: RendererSettings;
  public watchFunctions: WatchFunction[] = [];
  
  private paragraph!: Paragraph;
  private lastTextColor: string = '';
  private priorMarginBottom: number = 0;

  private static defaultCSS(): ParsedCSS {
    return {
      'font-family': 'times',
      'font-style': 'normal',
      'font-size': 1,
      'line-height': 1,
      'text-align': 'left',
      display: 'block',
      'margin-top': 0,
      'margin-bottom': 0,
      'margin-left': 0,
      'margin-right': 0,
      'padding-top': 0,
      'padding-bottom': 0,
      'padding-left': 0,
      'padding-right': 0,
      'word-spacing': 0,
      width: 0,
      height: 0,
      'border-width': 0,
      'border-color': 'rgb(0,0,0)',
      'border-style': 'none',
      'background-image': 'none',
      'page-break-before': 'auto',
      float: 'none',
      clear: 'none',
      color: 'rgb(0,0,0)',
    };
  }

  constructor(pdf: jsPDF, x: number, y: number, settings: RendererSettings) {
    this.pdf = pdf;
    this.x = x;
    this.y = y;
    this.settings = settings;
    this.init();
  }

  /**
   * Initializes the renderer
   */
  init(): void {
    this.paragraph = {
      text: [],
      style: [],
      blockstyle: Renderer.defaultCSS(),
    };
    
    // Save graphics state (q command)
    const internal = this.pdf.internal as any;
    if (internal.write) {
      internal.write('q');
    } else {
      this.pdf.saveGraphicsState();
    }
  }

  /**
   * Disposes the renderer and restores graphics state
   */
  dispose(): { x: number; y: number; ready: boolean } {
    // Restore graphics state (Q command)
    const internal = this.pdf.internal as any;
    if (internal.write) {
      internal.write('Q');
    } else {
      this.pdf.restoreGraphicsState();
    }

    return {
      x: this.x,
      y: this.y,
      ready: true,
    };
  }

  /**
   * Executes watch functions (e.g., for floating elements)
   */
  executeWatchFunctions(element?: Node): boolean {
    let ret = false;
    const newArray: WatchFunction[] = [];

    if (this.watchFunctions.length > 0) {
      for (let i = 0; i < this.watchFunctions.length; i++) {
        if (this.watchFunctions[i](element) === true) {
          ret = true;
        } else {
          newArray.push(this.watchFunctions[i]);
        }
      }
      this.watchFunctions = newArray;
    }

    return ret;
  }

  /**
   * Sets block boundary and renders paragraph
   */
  setBlockBoundary(cb?: (x: number, y: number) => void): number {
    return this.renderParagraph(cb);
  }

  /**
   * Sets block style CSS
   */
  setBlockStyle(css: ParsedCSS): ParsedCSS {
    return (this.paragraph.blockstyle = css);
  }

  /**
   * Adds text fragment to current paragraph
   */
  addText(text: string, css: ParsedCSS): void {
    this.paragraph.text.push(text);
    this.paragraph.style.push(css);
  }

  /**
   * Gets prior margin bottom
   */
  getPriorMarginBottom(): number {
    return this.priorMarginBottom;
  }

  /**
   * Sets prior margin bottom
   */
  setPriorMarginBottom(value: number): void {
    this.priorMarginBottom = value;
  }

  /**
   * Gets last text color
   */
  getLastTextColor(): string {
    return this.lastTextColor;
  }

  /**
   * Sets last text color
   */
  setLastTextColor(color: string): void {
    this.lastTextColor = color;
  }

  /**
   * Gets current paragraph
   */
  getParagraph(): Paragraph {
    return this.paragraph;
  }

  /**
   * Resets paragraph
   */
  resetParagraph(priorBlockstyle?: ParsedCSS): void {
    this.paragraph = {
      text: [],
      style: [],
      blockstyle: Renderer.defaultCSS(),
      priorblockstyle: priorBlockstyle,
    };
  }

  /**
   * Renders a paragraph of text
   * Ported from old plugin's renderParagraph function
   */
  renderParagraph(cb?: (x: number, y: number) => void): number {
    const blockstyle = this.paragraph.blockstyle;
    const priorblockstyle = this.paragraph.priorblockstyle || {};
    
    // Purge whitespace from fragments
    const fragments = purgeWhitespace([...this.paragraph.text]);
    const styles = [...this.paragraph.style];
    
    // Reset paragraph
    this.resetParagraph(blockstyle);
    
    // Skip if no content
    if (!fragments.join('').trim()) {
      return this.y;
    }

    // Split fragments into lines
    const lines = splitFragmentsIntoLines(
      this.pdf,
      fragments,
      styles,
      this.settings.width
    );

    const defaultFontSize = 12;
    const fontToUnitRatio = defaultFontSize / this.pdf.internal.scaleFactor;
    
    // Calculate spacing
    this.priorMarginBottom = this.priorMarginBottom || 0;
    const paragraphspacing_before =
      (Math.max(
        (blockstyle['margin-top'] || 0) - this.priorMarginBottom,
        0
      ) +
        (blockstyle['padding-top'] || 0)) *
      fontToUnitRatio;
    const paragraphspacing_after =
      ((blockstyle['margin-bottom'] || 0) +
        (blockstyle['padding-bottom'] || 0)) *
      fontToUnitRatio;
    this.priorMarginBottom = blockstyle['margin-bottom'] || 0;

    // Handle page break before
    if (blockstyle['page-break-before'] === 'always') {
      this.pdf.addPage();
      this.y = 0;
    }

    // Get internal write function (for low-level PDF operations)
    const internal = this.pdf.internal as any;
    const out = internal.write || (() => {});

    // Start text rendering
    this.y += paragraphspacing_before;
    
    if (internal.write) {
      // Format coordinates for PDF stream (using f2 for 2 decimal places)
      // Old plugin used internal.getCoordinateString, but we'll format directly
      const coordX = internal.getCoordinateString ? internal.getCoordinateString(this.x) : this.pdf.f2(this.x);
      const coordY = internal.getVerticalCoordinateString ? internal.getVerticalCoordinateString(this.y) : this.pdf.f2(this.y);
      
      out(
        'q',
        'BT 0 g',
        coordX,
        coordY,
        'Td'
      );
    } else {
      this.pdf.saveGraphicsState();
    }

    const pageHeight = this.pdf.internal.pageSize.getHeight();
    const margins = {
      top: (this.pdf as any).margins_doc?.top || 0,
      bottom: (this.pdf as any).margins_doc?.bottom || 0,
    };

    let currentIndent = 0;
    let fontSize = 0;

    // Render each line
    while (lines.length) {
      const line = lines.shift()!;
      let maxLineHeight = 0;

      // Calculate max line height first
      for (let i = 0; i < line.length; i++) {
        if (line[i][0].trim()) {
          maxLineHeight = Math.max(
            maxLineHeight,
            line[i][1]['line-height'],
            line[i][1]['font-size']
          );
          fontSize = line[i][1]['font-size'] * 7;
        }
      }
      
      const lineHeight = maxLineHeight * fontToUnitRatio;
      
      // Check for page break before rendering line
      if (this.y + lineHeight > pageHeight - margins.bottom && this.y > margins.top) {
        // Need page break before this line
        // End current text object and graphics state
        if (internal.write) {
          out('ET', 'Q');
        } else {
          this.pdf.restoreGraphicsState();
        }
        
        // Add new page
        this.pdf.addPage();
        this.y = margins.top;
        
        // Restart text rendering context on new page
        if (internal.write) {
          const coordX = internal.getCoordinateString ? internal.getCoordinateString(this.x) : this.pdf.f2(this.x);
          const coordY = internal.getVerticalCoordinateString ? internal.getVerticalCoordinateString(this.y) : this.pdf.f2(this.y);
          
          // Start new graphics state and text object
          // Get color from first fragment in line
          const firstFragment = line[0];
          if (firstFragment) {
            const pdfColor = getPdfColor(firstFragment[1].color);
            out(
              'q',
              'BT',
              pdfColor,
              coordX,
              coordY,
              'Td'
            );
            // Move cursor down by one line (as per old plugin)
            const firstLineHeight = Math.max(
              firstFragment[1]['line-height'] || 1,
              firstFragment[1]['font-size'] || 1
            );
            out(0, (-1 * defaultFontSize * firstLineHeight).toFixed(2), 'Td');
            // Update y position to account for the line we just moved down
            this.y += firstLineHeight * fontToUnitRatio;
          } else {
            out(
              'q',
              'BT 0 g',
              coordX,
              coordY,
              'Td'
            );
          }
        } else {
          this.pdf.saveGraphicsState();
        }
        
        // Reset indentation on new page
        currentIndent = 0;
      }

      // Handle indentation
      let indentMove = 0;
      let wantedIndent = 0;
      if (line[0] && line[0][1]['margin-left'] !== undefined && line[0][1]['margin-left'] > 0) {
        const internal = this.pdf.internal as any;
        const marginLeft = line[0][1]['margin-left'];
        // Convert margin to coordinate string format
        const coordStr = internal.getCoordinateString 
          ? internal.getCoordinateString(marginLeft)
          : this.pdf.f2(marginLeft);
        wantedIndent = typeof coordStr === 'string' ? parseFloat(coordStr) : coordStr;
        indentMove = wantedIndent - currentIndent;
        currentIndent = wantedIndent;
      }
      const indentMore =
        Math.max(blockstyle['margin-left'] || 0, 0) * fontToUnitRatio;

      // Move cursor (relative positioning)
      // Only apply Td if we need to move (indentation change or if we didn't just do a page break)
      // After a page break, we already moved down one line, so we don't want to move again
      const justDidPageBreak = this.y === margins.top && lines.length < lines.length + 1; // This is tricky to track
      
      if (internal.write) {
        // Always move down by line height (relative positioning)
        // The negative value moves DOWN in PDF coordinates
        out(
          indentMove + indentMore,
          (-1 * defaultFontSize * maxLineHeight).toFixed(2),
          'Td'
        );
      }

      // Render text fragments in line
      for (let i = 0; i < line.length; i++) {
        if (line[i][0]) {
          renderTextFragment(
            this.pdf,
            line[i][0],
            line[i][1],
            this.x,
            this.y,
            pageHeight,
            margins,
            { value: this.lastTextColor },
            { value: this.y } // Pass reference to renderer's y
          );
        }
      }

      // Move to next line
      this.y += maxLineHeight * fontToUnitRatio;

      // Check if watch functions were executed (for floating elements)
      if (
        line[0] &&
        this.executeWatchFunctions() &&
        lines.length > 0
      ) {
        // Recalculate lines if layout changed
        const localFragments: string[] = [];
        const localStyles: ParsedCSS[] = [];
        lines.forEach((localLine) => {
          for (let i = 0; i < localLine.length; i++) {
            if (localLine[i][0]) {
              localFragments.push(localLine[i][0] + ' ');
              localStyles.push(localLine[i][1]);
            }
          }
        });
        
        // Re-split lines
        const newLines = splitFragmentsIntoLines(
          this.pdf,
          purgeWhitespace(localFragments),
          localStyles,
          this.settings.width
        );
        lines.push(...newLines);
        
        // Reposition cursor
        if (internal.write) {
          const coordX = internal.getCoordinateString ? internal.getCoordinateString(this.x) : this.pdf.f2(this.x);
          const coordY = internal.getVerticalCoordinateString ? internal.getVerticalCoordinateString(this.y) : this.pdf.f2(this.y);
          
          out('ET', 'Q');
          out(
            'q',
            'BT 0 g',
            coordX,
            coordY,
            'Td'
          );
        } else {
          this.pdf.restoreGraphicsState();
          this.pdf.saveGraphicsState();
        }
      }
    }

    // Callback
    if (cb && typeof cb === 'function') {
      cb(this.x - 9, this.y - fontSize / 2);
    }

    // End text rendering
    if (internal.write) {
      out('ET', 'Q');
    } else {
      this.pdf.restoreGraphicsState();
    }

    return (this.y += paragraphspacing_after);
  }
}
