import { ParsedCSS, parseComputedCSS } from './cssParser';

export interface TextNode {
  tag: string;
  text: string;
  children?: TextNode[];
  isInline?: boolean; // For inline formatting tags like <strong>, <em>, <u>
  orderedSegments?: Array<{ type: 'text' | 'element'; content: string | TextNode }>; // Preserves order of text and inline elements
  css?: ParsedCSS; // Computed CSS styles for this element
  // Special element properties
  imageSrc?: string; // For <img> elements
  imageWidth?: number; // Image width in pixels
  imageHeight?: number; // Image height in pixels
  tableData?: TableData; // For <table> elements
  listType?: 'ordered' | 'unordered'; // For <ol> and <ul> elements
}

export interface TableData {
  headers: string[];
  rows: string[][];
  columnWidths?: number[]; // Relative widths (0-1)
}

/**
 * Parses DOM element and extracts text content from all tags
 * @param element - DOM element to parse
 * @returns Array of text nodes with tag information
 */
export function parseElement(element: HTMLElement): TextNode[] {
  const result: TextNode[] = [];

  /**
   * Check if a tag is an inline formatting tag
   */
  function isInlineFormattingTag(tag: string): boolean {
    const inlineTags = ['strong', 'b', 'em', 'i', 'u', 'span'];
    return inlineTags.includes(tag.toLowerCase());
  }

  /**
   * Extracts table data from a <table> element
   */
  function extractTable(tableElement: HTMLTableElement): TextNode | null {
    const headers: string[] = [];
    const rows: string[][] = [];
    
    // Extract headers from thead or first row
    const thead = tableElement.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        const cells = headerRow.querySelectorAll('th, td');
        cells.forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }
    } else {
      // Use first row as headers if no thead
      const firstRow = tableElement.querySelector('tr');
      if (firstRow) {
        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }
    }
    
    // Extract rows from tbody or all rows (excluding header row if no thead)
    const tbody = tableElement.querySelector('tbody');
    
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const rowData: string[] = [];
        row.querySelectorAll('td, th').forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      });
    } else {
      // Process all rows, skipping first if it was used as header
      const allRows = tableElement.querySelectorAll('tr');
      const startIndex = headers.length > 0 ? 1 : 0;
      for (let i = startIndex; i < allRows.length; i++) {
        const rowData: string[] = [];
        allRows[i].querySelectorAll('td, th').forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      }
    }
    
    // Calculate column widths based on actual rendered widths
    const columnWidths: number[] = [];
    if (tableElement.clientWidth > 0) {
      const firstRow = tableElement.querySelector('tr');
      if (firstRow) {
        const cells = firstRow.querySelectorAll('th, td');
        const totalWidth = tableElement.clientWidth;
        cells.forEach(cell => {
          columnWidths.push(cell.clientWidth / totalWidth);
        });
      }
    }
    
    if (headers.length === 0 && rows.length === 0) {
      return null;
    }
    
    return {
      tag: 'table',
      text: '',
      css: parseComputedCSS(tableElement),
      tableData: {
        headers,
        rows,
        columnWidths: columnWidths.length > 0 ? columnWidths : undefined
      }
    };
  }

  /**
   * Recursively extracts text from DOM elements
   * Processes nodes in order and preserves inline formatting
   */
  function extractText(el: HTMLElement, tagName: string, isInlineContext: boolean = false): TextNode | null {
    const children: TextNode[] = [];
    const directTextParts: string[] = [];
    const orderedSegments: Array<{ type: 'text' | 'element'; content: string | TextNode }> = [];
    const isInline = isInlineFormattingTag(tagName);
    
    // Parse CSS styles for this element
    const css = parseComputedCSS(el);
    
    // First pass: check if we have any inline children
    let hasInlineChildren = false;
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        const childTag = (node as HTMLElement).tagName.toLowerCase();
        if (isInlineFormattingTag(childTag)) {
          hasInlineChildren = true;
          break;
        }
      }
    }
    
    // Second pass: process all child nodes in order to preserve document order
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Process child element
        const childElement = node as HTMLElement;
        const childTag = childElement.tagName.toLowerCase() || 'text';
        
        // Handle self-closing elements like <hr>
        if (childTag === 'hr') {
          const hrNode: TextNode = {
            tag: 'hr',
            text: '',
            css: parseComputedCSS(childElement)
          };
          children.push(hrNode);
          if (hasInlineChildren) {
            orderedSegments.push({ type: 'element', content: hrNode });
          }
        } else if (childTag === 'img') {
          // Handle image elements
          const imgNode: TextNode = {
            tag: 'img',
            text: '',
            css: parseComputedCSS(childElement),
            imageSrc: childElement.getAttribute('src') || undefined,
            imageWidth: (childElement as HTMLImageElement).naturalWidth || childElement.clientWidth || undefined,
            imageHeight: (childElement as HTMLImageElement).naturalHeight || childElement.clientHeight || undefined,
          };
          children.push(imgNode);
          if (hasInlineChildren) {
            orderedSegments.push({ type: 'element', content: imgNode });
          }
        } else if (childTag === 'table') {
          // Handle table elements
          const tableNode = extractTable(childElement);
          if (tableNode) {
            children.push(tableNode);
            if (hasInlineChildren) {
              orderedSegments.push({ type: 'element', content: tableNode });
            }
          }
        } else if (childTag === 'ol' || childTag === 'ul') {
          // Handle list elements
          const listNode = extractText(childElement, childTag, false);
          if (listNode) {
            listNode.listType = childTag === 'ol' ? 'ordered' : 'unordered';
            children.push(listNode);
            if (hasInlineChildren) {
              orderedSegments.push({ type: 'element', content: listNode });
            }
          }
        } else {
          // Check if this is an inline formatting tag
          const childIsInline = isInlineFormattingTag(childTag);
          const childNode = extractText(childElement, childTag, childIsInline || isInlineContext);
          if (childNode && (childNode.text || (childNode.children && childNode.children.length > 0))) {
            // Mark inline formatting tags
            if (childIsInline) {
              childNode.isInline = true;
            }
            children.push(childNode);
            // Add to ordered segments if we have inline children
            if (hasInlineChildren) {
              orderedSegments.push({ type: 'element', content: childNode });
            }
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Collect direct text nodes
        // For ordered segments, preserve the text as-is to maintain spacing
        // For directTextParts, trim for normal processing
        const rawText = node.textContent || '';
        const trimmedText = isInlineContext ? rawText : rawText.trim();
        
        if (trimmedText && trimmedText.length > 0) {
          directTextParts.push(trimmedText);
        }
        
        // Add to ordered segments if we have inline children (preserve original text with spaces)
        if (hasInlineChildren) {
          // Normalize whitespace but preserve single spaces
          // Replace newlines with spaces, then collapse multiple spaces/tabs into single space
          const normalizedText = rawText.replace(/[\r\n]+/g, ' ').replace(/[ \t]+/g, ' ');
          // Only add if there's actual content (but preserve spaces between elements)
          if (normalizedText.length > 0) {
            orderedSegments.push({ type: 'text', content: normalizedText });
          }
        }
      }
    }

    const directText = isInlineContext 
      ? directTextParts.join('').trim() 
      : directTextParts.join(' ').trim();

    // Only return node if it has direct text or children
    if (directText || children.length > 0) {
      return {
        tag: tagName,
        text: directText,
        children: children.length > 0 ? children : undefined,
        isInline: isInline || undefined,
        orderedSegments: hasInlineChildren && orderedSegments.length > 0 ? orderedSegments : undefined,
        css: css
      };
    }

    return null;
  }

  // Process the element's direct children
  const childElements = element.children;
  for (let i = 0; i < childElements.length; i++) {
    const child = childElements[i] as HTMLElement;
    const childTag = child.tagName.toLowerCase() || 'unknown';
    
    // Handle self-closing elements like <hr>
    if (childTag === 'hr') {
      result.push({
        tag: 'hr',
        text: '',
        css: parseComputedCSS(child)
      });
    } else if (childTag === 'img') {
      // Handle image elements
      result.push({
        tag: 'img',
        text: '',
        css: parseComputedCSS(child),
        imageSrc: child.getAttribute('src') || undefined,
        imageWidth: (child as HTMLImageElement).naturalWidth || child.clientWidth || undefined,
        imageHeight: (child as HTMLImageElement).naturalHeight || child.clientHeight || undefined,
      });
    } else if (childTag === 'table') {
      // Handle table elements
      const tableNode = extractTable(child as HTMLTableElement);
      if (tableNode) {
        result.push(tableNode);
      }
    } else {
      const childIsInline = isInlineFormattingTag(childTag);
      const childNode = extractText(child, childTag, childIsInline);
      if (childNode && (childNode.text || (childNode.children && childNode.children.length > 0))) {
        if (childIsInline) {
          childNode.isInline = true;
        }
        if (childTag === 'ol' || childTag === 'ul') {
          childNode.listType = childTag === 'ol' ? 'ordered' : 'unordered';
        }
        result.push(childNode);
      }
    }
  }

  // If no children elements, check if element itself has direct text
  if (result.length === 0) {
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim())
      .filter(text => text && text.length > 0)
      .join(' ');
    
    if (directText) {
      result.push({
        tag: element.tagName.toLowerCase() || 'unknown',
        text: directText,
        css: parseComputedCSS(element)
      });
    }
  }

  return result;
}

/**
 * Extracts all text content from DOM element, flattening the structure
 * @param element - DOM element to parse
 * @returns Array of text strings
 */
export function extractAllText(element: HTMLElement): string[] {
  const nodes = parseElement(element);
  const texts: string[] = [];

  function collectText(node: TextNode) {
    if (node.text) {
      texts.push(node.text);
    }
    if (node.children) {
      node.children.forEach(collectText);
    }
  }

  nodes.forEach(collectText);
  return texts.filter(text => text.length > 0);
}
