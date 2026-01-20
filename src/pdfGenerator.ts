import { jsPDF } from 'jspdf';
import { TextNode, TableData } from './htmlParser';
import { ParsedCSS, parseRGB } from './cssParser';

/**
 * Creates a PDF document from text nodes
 * @param nodes - Array of text nodes to add to PDF
 * @returns Promise that resolves with jsPDF document instance
 */
export async function createPdfFromNodes(nodes: TextNode[]): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const defaultMargin = 20;
  let currentMargin = defaultMargin;
  let yPosition = currentMargin;
  let maxWidth = pageWidth - (currentMargin * 2);
  
  // Cache for loaded images
  const imageCache = new Map<string, HTMLImageElement | string>();

  /**
   * Normalizes whitespace in text to match browser behavior
   */
  function normalizeWhitespace(text: string): string {
    let normalized = text.replace(/[\r\n]+/g, ' ');
    normalized = normalized.replace(/[ \t]+/g, ' ');
    return normalized.trim();
  }

  /**
   * Checks if we need a new page and adds one if necessary
   */
  function checkPageBreak(requiredHeight: number): void {
    if (yPosition + requiredHeight > pageHeight - currentMargin) {
      doc.addPage();
      yPosition = currentMargin;
    }
  }

  /**
   * Applies CSS color to PDF (text or fill)
   */
  function applyColor(color: string, isFill: boolean = false): void {
    const rgb = parseRGB(color);
    if (isFill) {
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
    } else {
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
    }
  }

  /**
   * Gets default formatting from CSS or tag
   */
  function getFormattingFromCSS(css: ParsedCSS | undefined, tag: string): {
    fontSize: number;
    fontFamily: string;
    fontStyle: string;
    color: string;
  } {
    if (css) {
      return {
        fontSize: css.fontSize,
        fontFamily: css.fontFamily,
        fontStyle: css.fontStyle === 'italic' ? 'italic' : css.fontWeight === 'bold' ? 'bold' : 'normal',
        color: css.color,
      };
    }
    
    // Fallback to tag-based formatting
    const tagLower = tag.toLowerCase();
    let fontSize = 12;
    let fontStyle = 'normal';
    
    switch (tagLower) {
      case 'h1': fontSize = 24; fontStyle = 'bold'; break;
      case 'h2': fontSize = 20; fontStyle = 'bold'; break;
      case 'h3': fontSize = 18; fontStyle = 'bold'; break;
      case 'h4': fontSize = 16; fontStyle = 'bold'; break;
      case 'h5': fontSize = 14; fontStyle = 'bold'; break;
      case 'h6': fontSize = 12; fontStyle = 'bold'; break;
      case 'strong':
      case 'b': fontStyle = 'bold'; break;
      case 'em':
      case 'i': fontStyle = 'italic'; break;
    }
    
    return {
      fontSize,
      fontFamily: 'helvetica',
      fontStyle,
      color: 'rgb(0,0,0)',
    };
  }

  /**
   * Loads an image and caches it
   */
  async function loadImage(src: string): Promise<string | HTMLImageElement | null> {
    if (imageCache.has(src)) {
      return imageCache.get(src)!;
    }

    return new Promise((resolve) => {
      // Handle data URLs
      if (src.startsWith('data:')) {
        imageCache.set(src, src);
        resolve(src);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        imageCache.set(src, img);
        resolve(img);
      };
      
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        resolve(null);
      };
      
      img.src = src;
    });
  }

  /**
   * Renders an image element
   */
  async function renderImage(node: TextNode): Promise<void> {
    if (!node.imageSrc) return;

    const img = await loadImage(node.imageSrc);
    if (!img) return;

    const css = node.css;
    const marginTop = css?.marginTop || 0;
    const marginBottom = css?.marginBottom || 0;
    const marginLeft = css?.marginLeft || 0;
    
    // Calculate image dimensions
    let imgWidth = node.imageWidth || 100;
    let imgHeight = node.imageHeight || 100;
    
    // Scale to fit page width if needed
    const maxImgWidth = maxWidth - marginLeft;
    if (imgWidth > maxImgWidth) {
      const scale = maxImgWidth / imgWidth;
      imgWidth = maxImgWidth;
      imgHeight = imgHeight * scale;
    }
    
    checkPageBreak(imgHeight + marginTop + marginBottom);
    
    yPosition += marginTop;
    
    const xPos = currentMargin + marginLeft;
    
    try {
      if (typeof img === 'string') {
        // Data URL
        doc.addImage(img, 'PNG', xPos, yPosition, imgWidth, imgHeight);
      } else {
        // HTMLImageElement
        doc.addImage(img, xPos, yPosition, imgWidth, imgHeight);
      }
    } catch (error) {
      console.warn('Failed to add image to PDF:', error);
    }
    
    yPosition += imgHeight + marginBottom;
  }

  /**
   * Renders a table element
   */
  function renderTable(node: TextNode): void {
    if (!node.tableData) return;

    const css = node.css;
    const marginTop = css?.marginTop || 0;
    const marginBottom = css?.marginBottom || 0;
    
    const tableData = node.tableData;
    const headers = tableData.headers;
    const rows = tableData.rows;
    
    if (headers.length === 0 && rows.length === 0) return;

    // Estimate table height (rough calculation)
    const rowHeight = 8;
    const headerHeight = 10;
    const estimatedHeight = headerHeight + (rows.length * rowHeight) + marginTop + marginBottom;
    
    checkPageBreak(estimatedHeight);
    
    yPosition += marginTop;
    
    const startY = yPosition;
    const tableWidth = maxWidth;
    const colCount = Math.max(headers.length, rows.length > 0 ? rows[0].length : 0);
    
    if (colCount === 0) return;

    // Calculate column widths
    const colWidths: number[] = [];
    if (tableData.columnWidths && tableData.columnWidths.length === colCount) {
      tableData.columnWidths.forEach(w => colWidths.push(w * tableWidth));
    } else {
      // Equal widths
      const equalWidth = tableWidth / colCount;
      for (let i = 0; i < colCount; i++) {
        colWidths.push(equalWidth);
      }
    }

    // Render header
    if (headers.length > 0) {
      let xPos = currentMargin;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      applyColor(css?.color || 'rgb(0,0,0)');
      
      for (let i = 0; i < headers.length && i < colCount; i++) {
        const cellText = headers[i] || '';
        const cellWidth = colWidths[i];
        
        // Draw cell border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(xPos, yPosition, cellWidth, headerHeight);
        
        // Draw text
        const lines = doc.splitTextToSize(cellText, cellWidth - 4);
        doc.text(lines[0] || '', xPos + 2, yPosition + 7);
        
        xPos += cellWidth;
      }
      
      yPosition += headerHeight;
    }

    // Render rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    for (const row of rows) {
      checkPageBreak(rowHeight);
      
      let xPos = currentMargin;
      
      for (let i = 0; i < row.length && i < colCount; i++) {
        const cellText = row[i] || '';
        const cellWidth = colWidths[i];
        
        // Draw cell border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(xPos, yPosition, cellWidth, rowHeight);
        
        // Draw text
        const lines = doc.splitTextToSize(cellText, cellWidth - 4);
        doc.text(lines[0] || '', xPos + 2, yPosition + 6);
        
        xPos += cellWidth;
      }
      
      yPosition += rowHeight;
    }
    
    yPosition += marginBottom;
  }

  /**
   * Renders a list element (ul/ol)
   */
  async function renderList(node: TextNode): Promise<void> {
    const listIndex = { value: 1 }; // Reset counter for each list
    const css = node.css;
    const marginTop = css?.marginTop || 0;
    const marginBottom = css?.marginBottom || 0;
    const marginLeft = css?.marginLeft || 0;
    const paddingLeft = css?.paddingLeft || 0;
    
    yPosition += marginTop;
    
    if (!node.children || node.children.length === 0) {
      yPosition += marginBottom;
      return;
    }

    const isOrdered = node.listType === 'ordered';
    const indent = 15;
    const bulletRadius = 2;
    
    for (const child of node.children) {
      if (child.tag.toLowerCase() === 'li') {
        checkPageBreak(10);
        
        const xPos = currentMargin + marginLeft + paddingLeft;
        const bulletX = xPos - indent;
        
        // Draw bullet or number
        if (isOrdered) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          applyColor(css?.color || 'rgb(0,0,0)');
          doc.text(`${listIndex.value}.`, bulletX, yPosition + 5);
          listIndex.value++;
        } else {
          doc.setFillColor(0, 0, 0);
          doc.circle(bulletX, yPosition + 3, bulletRadius, 'F');
        }
        
        // Render list item content
        if (child.text && child.text.trim()) {
          const itemFormatting = getFormattingFromCSS(child.css, child.tag);
          const itemFontSize = itemFormatting.fontSize;
          const itemLineHeight = Math.min((child.css?.lineHeight || 1.05) * itemFontSize, itemFontSize * 1.1);
          
          doc.setFontSize(itemFontSize);
          doc.setFont(itemFormatting.fontFamily, itemFormatting.fontStyle);
          applyColor(itemFormatting.color);
          
          const lines = doc.splitTextToSize(normalizeWhitespace(child.text), maxWidth - indent - marginLeft - paddingLeft);
          doc.text(lines[0] || '', xPos, yPosition + 5);
          yPosition += lines.length > 1 ? lines.length * itemLineHeight : itemLineHeight;
        } else if (child.children) {
          // Process nested content
          for (const nestedChild of child.children) {
            await processNode(nestedChild, 0);
          }
        } else {
          yPosition += 7;
        }
      } else {
        // Process non-li children
        await processNode(child, 0);
      }
    }
    
    yPosition += marginBottom;
  }

  /**
   * Renders text with CSS styling
   */
  function renderText(
    text: string,
    css: ParsedCSS | undefined,
    tag: string,
    alignment: 'left' | 'right' | 'center' | 'justify' = 'left'
  ): void {
    if (!text || !text.trim()) return;

    const formatting = getFormattingFromCSS(css, tag);
    const fontSize = formatting.fontSize;
    // Use very tight default line-height and cap CSS line-height aggressively
    const cssLineHeight = css?.lineHeight || 1.05;
    // Cap line-height very aggressively - max 1.1x font size for normal text
    const lineHeight = Math.min(cssLineHeight * fontSize, fontSize * 1.1);
    
    // Only apply margins/padding for block-level elements, and reduce them significantly
    const isBlock = !css || css.display === 'block';
    // For paragraphs and common text elements, use minimal or no margins
    const isTextElement = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag.toLowerCase());
    
    // Cap margins aggressively - max 3pt for headings, 0 for paragraphs
    let marginTop = 0;
    let marginBottom = 0;
    if (isBlock && !isTextElement) {
      marginTop = Math.min(css?.marginTop || 0, 5);
      marginBottom = Math.min(css?.marginBottom || 0, 5);
    } else if (isBlock && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag.toLowerCase())) {
      // Small margins for headings only
      marginTop = Math.min(css?.marginTop || 0, 3);
      marginBottom = Math.min(css?.marginBottom || 0, 2);
    }
    const marginLeft = css?.marginLeft || 0;
    const paddingTop = isBlock ? (css?.paddingTop || 0) : 0;
    const paddingBottom = isBlock ? (css?.paddingBottom || 0) : 0;
    
    doc.setFontSize(fontSize);
    doc.setFont(formatting.fontFamily, formatting.fontStyle);
    applyColor(formatting.color);
    
    const normalizedText = normalizeWhitespace(text);
    const availableWidth = maxWidth - marginLeft;
    const lines = doc.splitTextToSize(normalizedText, availableWidth);
    
    checkPageBreak((lines.length * lineHeight) + marginTop + marginBottom + paddingTop + paddingBottom);
    
    yPosition += marginTop + paddingTop;
    
    let xPos = currentMargin + marginLeft;
    
    for (const line of lines) {
      checkPageBreak(lineHeight);
      
      // Handle text alignment
      if (alignment === 'center') {
        const textWidth = doc.getTextWidth(line);
        xPos = currentMargin + (maxWidth / 2) - (textWidth / 2);
      } else if (alignment === 'right') {
        const textWidth = doc.getTextWidth(line);
        xPos = currentMargin + maxWidth - textWidth - marginLeft;
      } else {
        xPos = currentMargin + marginLeft;
      }
      
      doc.text(line, xPos, yPosition);
      yPosition += lineHeight;
    }
    
    yPosition += marginBottom + paddingBottom;
  }

  /**
   * Renders inline formatted text segments
   */
  function renderInlineText(segments: Array<{
    text: string;
    fontSize: number;
    fontFamily: string;
    fontStyle: string;
    color: string;
  }>, css: ParsedCSS | undefined): void {
    if (segments.length === 0) return;

    const fontSize = css?.fontSize || 12;
    const cssLineHeight = css?.lineHeight || 1.05;
    // Cap line-height very aggressively - max 1.1x font size
    const lineHeight = Math.min(cssLineHeight * fontSize, fontSize * 1.1);
    
    // Only apply margins for block-level elements, minimal for inline text
    const isBlock = !css || css.display === 'block';
    const marginTop = isBlock ? Math.min(css?.marginTop || 0, 2) : 0; // Cap margin at 2pt
    const marginBottom = isBlock ? Math.min(css?.marginBottom || 0, 2) : 0; // Cap margin at 2pt
    
    checkPageBreak(lineHeight + marginTop + marginBottom);
    
    yPosition += marginTop;
    
    let currentX = currentMargin;
    let currentLineSegments: typeof segments = [];
    let currentLineWidth = 0;
    
    function flushLine() {
      if (currentLineSegments.length === 0) return;
      
      checkPageBreak(lineHeight);
      
      let xPos = currentMargin;
      for (let i = 0; i < currentLineSegments.length; i++) {
        const segment = currentLineSegments[i];
        doc.setFontSize(segment.fontSize);
        doc.setFont(segment.fontFamily, segment.fontStyle);
        applyColor(segment.color);
        
        // Render text as-is (spaces are already preserved in the segments)
        const textToRender = segment.text || '';
        
        if (textToRender) {
          doc.text(textToRender, xPos, yPosition);
          xPos += doc.getTextWidth(textToRender);
        }
      }
      
      yPosition += lineHeight;
      currentLineSegments = [];
      currentLineWidth = 0;
    }
    
    for (const segment of segments) {
      doc.setFontSize(segment.fontSize);
      doc.setFont(segment.fontFamily, segment.fontStyle);
      
      // Text already contains spaces from HTML, so use it as-is
      const textToRender = segment.text || '';
      const segmentWidth = doc.getTextWidth(textToRender);
      
      if (currentLineWidth + segmentWidth > maxWidth && currentLineSegments.length > 0) {
        flushLine();
        currentX = currentMargin;
      }
      
      currentLineSegments.push(segment);
      currentLineWidth += segmentWidth;
    }
    
    if (currentLineSegments.length > 0) {
      flushLine();
    }
    
    yPosition += marginBottom;
  }

  /**
   * Collects inline formatted segments from a node
   */
  function collectInlineSegments(
    node: TextNode,
    baseFormatting: { fontSize: number; fontFamily: string; fontStyle: string; color: string },
    depth: number
  ): Array<{ text: string; fontSize: number; fontFamily: string; fontStyle: string; color: string }> {
    const segments: Array<{ text: string; fontSize: number; fontFamily: string; fontStyle: string; color: string }> = [];
    const nodeFormatting = getFormattingFromCSS(node.css, node.tag);
    
    // Combine formatting
    const combinedFormatting = {
      fontSize: nodeFormatting.fontSize || baseFormatting.fontSize,
      fontFamily: nodeFormatting.fontFamily || baseFormatting.fontFamily,
      fontStyle: nodeFormatting.fontStyle === 'bold' || baseFormatting.fontStyle === 'bold' ? 'bold' :
                 nodeFormatting.fontStyle === 'italic' || baseFormatting.fontStyle === 'italic' ? 'italic' : 'normal',
      color: nodeFormatting.color || baseFormatting.color,
    };
    
    if (node.orderedSegments && node.orderedSegments.length > 0) {
      for (const segment of node.orderedSegments) {
        if (segment.type === 'text') {
          const text = segment.content as string;
          // Preserve text even if it's just spaces (important for spacing between elements)
          if (text !== null && text !== undefined) {
            segments.push({ text, ...combinedFormatting });
          }
        } else if (segment.type === 'element') {
          const childNode = segment.content as TextNode;
          if (childNode.isInline || isInlineFormattingTag(childNode.tag)) {
            segments.push(...collectInlineSegments(childNode, combinedFormatting, depth + 1));
          }
        }
      }
      return segments;
    }
    
    if (node.text !== null && node.text !== undefined) {
      segments.push({ text: node.text, ...combinedFormatting });
    }
    
    if (node.children) {
      for (const child of node.children) {
        if (child.isInline || isInlineFormattingTag(child.tag)) {
          segments.push(...collectInlineSegments(child, combinedFormatting, depth + 1));
        }
      }
    }
    
    return segments;
  }

  function isInlineFormattingTag(tag: string): boolean {
    return ['strong', 'b', 'em', 'i', 'u', 'span'].includes(tag.toLowerCase());
  }

  /**
   * Processes a node and renders it to PDF
   */
  async function processNode(node: TextNode, depth: number = 0): Promise<void> {
    const tag = node.tag.toLowerCase();
    const css = node.css;
    
    // Handle special elements
    if (tag === 'hr') {
      checkPageBreak(15);
      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(currentMargin, yPosition, pageWidth - currentMargin, yPosition);
      yPosition += 15;
      return;
    }
    
    if (tag === 'img') {
      await renderImage(node);
      return;
    }
    
    if (tag === 'table') {
      renderTable(node);
      return;
    }
    
    if (tag === 'ol' || tag === 'ul') {
      await renderList(node);
      return;
    }
    
    // Handle text content
    const hasInlineChildren = node.children && node.children.some(child => 
      child.isInline || isInlineFormattingTag(child.tag)
    );
    
    if (hasInlineChildren || node.isInline) {
      const baseFormatting = getFormattingFromCSS(css, tag);
      const segments = collectInlineSegments(node, baseFormatting, depth);
      if (segments.length > 0) {
        renderInlineText(segments, css);
      }
    } else {
      if (node.text && node.text.trim()) {
        const alignment = css?.textAlign || 'left';
        renderText(node.text, css, tag, alignment);
      }
      
      if (node.children) {
        for (const child of node.children) {
          if (!child.isInline && !isInlineFormattingTag(child.tag)) {
            await processNode(child, depth + 1);
          }
        }
      }
    }
  }

  // Process all nodes (await image loading)
  for (const node of nodes) {
    await processNode(node);
  }

  return doc;
}

/**
 * Converts jsPDF document to Blob for browser download
 */
export function pdfToBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}
