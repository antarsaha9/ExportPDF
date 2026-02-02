import { jsPDF } from 'jspdf';
import { FromHTMLSettings, Margins, ElementHandlers, ParsedCSS } from './types';
import { Renderer } from './renderer/Renderer';
import { getCSS } from './parser/cssParser';
import { renderTable } from './renderer/TableRenderer';
import { renderImage } from './renderer/ImageRenderer';
import { getNextListNumber, renderBulletPoint, resetListCounter, restoreListCounter } from './renderer/ListRenderer';
import { checkForFooter } from './renderer/HeaderFooterRenderer';
import { renderHR } from './renderer/ElementRenderer';
import { renderBackgroundImage } from './renderer/BackgroundRenderer';
import { normalizeUnicode } from './utils/unicode';

/**
 * Nodes to skip during traversal
 */
const SkipNode: Record<string, number> = {
  SCRIPT: 1,
  STYLE: 1,
  NOSCRIPT: 1,
  OBJECT: 1,
  EMBED: 1,
  SELECT: 1,
};

/**
 * Image cache (shared with ImageRenderer)
 * Stores either an HTMLImageElement or a dataURL string (e.g. PNG).
 */
const images: Record<string, HTMLImageElement | string> = {};

/**
 * List counter for ordered lists
 */
let listCount = 1;

/**
 * Checks if element should be handled by custom handlers
 */
function elementHandledElsewhere(
  element: HTMLElement,
  renderer: Renderer,
  elementHandlers: ElementHandlers
): boolean {
  let isHandledElsewhere = false;

  // Check by ID
  const idHandlers = elementHandlers['#' + element.id];
  if (idHandlers) {
    if (typeof idHandlers === 'function') {
      isHandledElsewhere = idHandlers(element, renderer);
    } else if (Array.isArray(idHandlers)) {
      for (let i = 0; i < idHandlers.length && !isHandledElsewhere; i++) {
        isHandledElsewhere = idHandlers[i](element, renderer);
      }
    }
  }

  // Check by tag name
  if (!isHandledElsewhere) {
    const tagHandlers = elementHandlers[element.nodeName];
    if (tagHandlers) {
      if (typeof tagHandlers === 'function') {
        isHandledElsewhere = tagHandlers(element, renderer);
      } else if (Array.isArray(tagHandlers)) {
        for (let i = 0; i < tagHandlers.length && !isHandledElsewhere; i++) {
          isHandledElsewhere = tagHandlers[i](element, renderer);
        }
      }
    }
  }

  // Check by class name
  if (!isHandledElsewhere) {
    const classNames =
      typeof element.className === 'string'
        ? element.className.split(' ')
        : [];
    for (let i = 0; i < classNames.length; i++) {
      const classHandlers = elementHandlers['.' + classNames[i]];
      if (classHandlers) {
        if (typeof classHandlers === 'function') {
          isHandledElsewhere = classHandlers(element, renderer);
        } else if (Array.isArray(classHandlers)) {
          for (
            let j = 0;
            j < classHandlers.length && !isHandledElsewhere;
            j++
          ) {
            isHandledElsewhere = classHandlers[j](element, renderer);
          }
        }
        if (isHandledElsewhere) break;
      }
    }
  }

  return isHandledElsewhere;
}

/**
 * Recursively traverses DOM and renders content
 * Ported from old plugin's DrillForContent function
 * Exported for use in HeaderFooterRenderer
 */
export function drillForContent(
  element: HTMLElement,
  renderer: Renderer,
  elementHandlers: ElementHandlers,
  cssOverride?: Partial<ParsedCSS>,
  blockCallback?: (x: number, y: number) => void
): void {
  const cns = element.childNodes;
  let fragmentCSS = getCSS(element);
  
  // Apply CSS overrides (e.g., for PRE/CODE to force monospace)
  if (cssOverride) {
    fragmentCSS = { ...fragmentCSS, ...cssOverride };
  }
  
  const isBlock = fragmentCSS.display === 'block';

  if (isBlock) {
    // Use provided callback if available, otherwise use default
    renderer.setBlockBoundary(blockCallback);
    // Apply CSS override to block style if provided
    const finalBlockStyle = cssOverride ? { ...fragmentCSS, ...cssOverride } : fragmentCSS;
    renderer.setBlockStyle(finalBlockStyle);

    // Best-effort: render block background-image before children
    renderBackgroundImage(element, renderer, images);
  }

  const px2pt = 0.264583 * 72 / 25.4;

  for (let i = 0; i < cns.length; i++) {
    const cn = cns[i];

    if (typeof cn === 'object' && cn.nodeType === Node.ELEMENT_NODE) {
      const elementNode = cn as HTMLElement;

      // Execute watch functions
      renderer.executeWatchFunctions(cn);

      // Handle HEADER element
      if (elementNode.nodeName === 'HEADER') {
        const header = elementNode;
        const margins = (renderer.pdf as any).margins_doc || { top: 0 };
        const oldMarginTop = margins.top;
        
        // Subscribe to addPage event to render header on each new page
        renderer.pdf.internal.events.subscribe(
          'addPage',
          function (pageInfo: any) {
            // Set position to top margin
            renderer.y = oldMarginTop;
            
            // Render header content
            drillForContent(header, renderer, elementHandlers);
            
            // Update top margin to account for header height + spacing
            margins.top = renderer.y + 10;
            renderer.y += 10;
          },
          false
        );
        
        // Render header on first page
        renderer.y = oldMarginTop;
        drillForContent(header, renderer, elementHandlers);
        margins.top = renderer.y + 10;
        renderer.y += 10;
      }

      // Handle element nodes
      if (
        cn.nodeType === Node.ELEMENT_NODE &&
        !SkipNode[(elementNode.nodeName || '').toUpperCase()]
      ) {
        const nodeName = elementNode.nodeName.toUpperCase();
        
        // Handle IMG elements
        if (nodeName === 'IMG') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            renderImage(elementNode as HTMLImageElement, renderer, images);
          }
        }
        // Handle TABLE elements
        else if (nodeName === 'TABLE') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            renderTable(elementNode as HTMLTableElement, renderer, elementHandlers);
          }
        }
        // Handle list elements
        else if (nodeName === 'OL' || nodeName === 'UL') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            // Reset counter for ordered lists (saves parent counter on stack)
            if (nodeName === 'OL') {
              resetListCounter();
            }
            // Process list items - the list structure will be handled by drillForContent
            // Preserve parent callback if this is a nested list (don't overwrite parent LI's bullet callback)
            drillForContent(elementNode, renderer, elementHandlers, undefined, blockCallback);
            // Restore parent counter for ordered lists
            if (nodeName === 'OL') {
              restoreListCounter();
            }
          }
        }
        // Handle LI elements
        else if (nodeName === 'LI') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            const tempX = renderer.x;
            const indent = 20 / renderer.pdf.internal.scaleFactor;
            renderer.x += indent;
            renderer.y += 3;
            
            // Set up bullet callback for unordered lists
            const parent = elementNode.parentNode;
            let bulletCallback: ((x: number, y: number) => void) | undefined;
            if (parent && parent.nodeName === 'UL') {
              // For unordered lists, set up bullet callback
              // The callback will be called when the paragraph is rendered
              const liCSS = getCSS(elementNode);
              const fontSize = liCSS['font-size'] || 1;
              const offsetX = (3 - fontSize * 0.75) * renderer.pdf.internal.scaleFactor;
              const offsetY = fontSize * 0.75 * renderer.pdf.internal.scaleFactor;
              const radius = (fontSize * 1.74) / renderer.pdf.internal.scaleFactor;
              
              // Create callback to draw bullet at text position
              // The callback receives (x, y) which is the text rendering position
              // We need to draw the bullet relative to that position, but adjusted for the indent
              bulletCallback = (x: number, y: number) => {
                const finalRadius = radius > 0 && radius <= 10 ? radius : 2 / renderer.pdf.internal.scaleFactor;
                renderer.pdf.setFillColor(0, 0, 0);
                // x is the text position (already indented), so we draw bullet relative to that
                // offsetX moves bullet left from text position
                renderer.pdf.circle(x + offsetX, y + offsetY, finalRadius, 'F');
              };
            }
            // For ordered lists, number is added in text node processing
            
            // Process content with bullet callback passed to drillForContent
            // This ensures the callback is used when setBlockBoundary is called
            // The callback will be preserved and used even when nested lists are processed
            drillForContent(elementNode, renderer, elementHandlers, undefined, bulletCallback);
            
            renderer.x = tempX;
          }
        }
        // Handle HR (horizontal rule) elements
        else if (nodeName === 'HR') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            renderHR(elementNode, renderer);
          }
        }
        // Handle BLOCKQUOTE elements
        else if (nodeName === 'BLOCKQUOTE') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            const css = getCSS(elementNode);
            const fontToUnitRatio = 12 / renderer.pdf.internal.scaleFactor;
            const marginTop = (css['margin-top'] || 0) * fontToUnitRatio;
            const marginBottom = (css['margin-bottom'] || 0) * fontToUnitRatio;
            const marginLeft = (css['margin-left'] || 0) * fontToUnitRatio;
            const paddingLeft = (css['padding-left'] || 0) * fontToUnitRatio;
            
            renderer.y += marginTop;
            
            // Indent for blockquote
            const indent = marginLeft + paddingLeft + (marginLeft === 0 && paddingLeft === 0 ? 40 : 0);
            const tempX = renderer.x;
            const originalY = renderer.y;
            renderer.x += indent;
            
            // Process content
            drillForContent(elementNode, renderer, elementHandlers);
            
            // Draw left border (visual indicator for blockquote)
            const endY = renderer.y;
            if (endY > originalY) {
              renderer.pdf.setDrawColor(200, 200, 200);
              renderer.pdf.setLineWidth(2);
              const borderX = tempX + indent - 20; // 20pt left of content
              renderer.pdf.line(borderX, originalY, borderX, endY);
            }
            
            // Reset X position
            renderer.x = tempX;
            renderer.y += marginBottom;
          }
        }
        // Handle PRE elements (preformatted text with monospace)
        else if (nodeName === 'PRE') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            const css = getCSS(elementNode);
            const fontToUnitRatio = 12 / renderer.pdf.internal.scaleFactor;
            const marginTop = (css['margin-top'] || 0) * fontToUnitRatio;
            const marginBottom = (css['margin-bottom'] || 0) * fontToUnitRatio;
            const padding = (css['padding-left'] || css['padding-top'] || 10) * fontToUnitRatio;
            
            renderer.y += marginTop;
            
            // Add padding
            const tempX = renderer.x;
            renderer.x += padding;
            
            // Force monospace font by passing CSS override
            drillForContent(elementNode, renderer, elementHandlers, { 'font-family': 'courier' });
            
            // Reset X position
            renderer.x = tempX;
            renderer.y += marginBottom;
          }
        }
        // Handle CODE elements (inline code with monospace)
        else if (nodeName === 'CODE') {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            // Force monospace font - pass CSS override
            drillForContent(elementNode, renderer, elementHandlers, { 'font-family': 'courier' });
          }
        }
        // Handle BR elements
        else if (nodeName === 'BR') {
          const brCSS = fragmentCSS;
          const fontSize = (brCSS['font-size'] || 1) * 12;
          renderer.y += fontSize * renderer.pdf.internal.scaleFactor;
          renderer.addText('\u2028', brCSS); // Unicode line separator
        }
        // Handle other elements recursively
        else {
          if (!elementHandledElsewhere(elementNode, renderer, elementHandlers)) {
            // Pass CSS override if parent had one (for PRE/CODE font inheritance)
            drillForContent(elementNode, renderer, elementHandlers, cssOverride);
          }
        }
      }
    } else if (cn.nodeType === Node.TEXT_NODE) {
      // Handle text nodes
      const textNode = cn as Text;
      
      // Skip text nodes inside tables (tables handle their own content)
      let parent = textNode.parentNode;
      while (parent && parent.nodeType === Node.ELEMENT_NODE) {
        if ((parent as HTMLElement).nodeName === 'TABLE' || 
            (parent as HTMLElement).nodeName === 'THEAD' ||
            (parent as HTMLElement).nodeName === 'TBODY' ||
            (parent as HTMLElement).nodeName === 'TFOOT' ||
            (parent as HTMLElement).nodeName === 'TR' ||
            (parent as HTMLElement).nodeName === 'TH' ||
            (parent as HTMLElement).nodeName === 'TD') {
          // Skip - table will handle this
          break;
        }
        parent = parent.parentNode;
      }
      
      // If we're inside a table, skip this text node
      if (parent && (parent as HTMLElement).nodeName === 'TABLE') {
        continue;
      }
      
      let value = normalizeUnicode(textNode.nodeValue || '');

      // Handle list items - only add number prefix if text has real content
      if (
        value.trim() &&
        textNode.parentNode &&
        (textNode.parentNode as HTMLElement).nodeName === 'LI'
      ) {
        const parent = textNode.parentNode as HTMLElement;
        if (parent.parentNode && (parent.parentNode as HTMLElement).nodeName === 'OL') {
          // Only number the first text node in the LI (avoid numbering text after nested lists)
          let isFirstTextNode = true;
          for (let j = 0; j < parent.childNodes.length; j++) {
            const sibling = parent.childNodes[j];
            if (sibling === textNode) break;
            if (sibling.nodeType === Node.TEXT_NODE && (sibling.nodeValue || '').trim()) {
              isFirstTextNode = false;
              break;
            }
          }
          if (isFirstTextNode) {
            value = getNextListNumber() + '. ' + value;
          }
        }
        // For unordered lists, bullet callback is set when processing LI element
      }

      // Only add text if it's in the body element
      if (
        textNode.ownerDocument &&
        textNode.ownerDocument.body &&
        textNode.ownerDocument.body.compareDocumentPosition(textNode) & 16
      ) {
        let parentCSS = textNode.parentNode
          ? getCSS(textNode.parentNode as HTMLElement)
          : fragmentCSS;
        
        // Apply CSS override if parent is CODE or PRE
        const parent = textNode.parentNode as HTMLElement;
        if (parent && (parent.nodeName === 'CODE' || parent.nodeName === 'PRE')) {
          parentCSS = { ...parentCSS, 'font-family': 'courier' };
        }
        
        renderer.addText(value, parentCSS);
      }
    } else if (typeof cn === 'string') {
      renderer.addText(cn, fragmentCSS);
    }
  }

  if (isBlock) {
    // Use the callback if provided (e.g., for bullet points)
    renderer.setBlockBoundary(blockCallback);
  }
}

/**
 * Loads images from element
 */
function loadImages(
  element: HTMLElement,
  renderer: Renderer,
  elementHandlers: ElementHandlers,
  cb: (found_images: number) => void
): void {
  const imgs = element.getElementsByTagName('img');
  const l = imgs.length;
  let found_images = 0;
  let x = 0;

  function done() {
    renderer.pdf.internal.events.publish('imagesLoaded');
    cb(found_images);
  }

  function loadImage(url: string | null, width?: number, height?: number) {
    if (!url) return;

    const img = new Image();
    found_images = ++x;
    img.crossOrigin = '';
    img.onerror = img.onload = function () {
      if (img.complete) {
        // Support data URLs
        if (img.src.indexOf('data:image/') === 0) {
          img.width = width || img.width || 0;
          img.height = height || img.height || 0;
        }
        // Add to cache (convert SVG data URLs to PNG for jsPDF compatibility)
        if (img.width + img.height) {
          const hash = (renderer.pdf as any).sHashCode
            ? (renderer.pdf as any).sHashCode(url)
            : url;

          const isSvgDataUrl = img.src.startsWith('data:image/svg+xml');
          if (isSvgDataUrl) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width || (img as any).naturalWidth || 0;
              canvas.height = img.height || (img as any).naturalHeight || 0;
              const ctx = canvas.getContext('2d');
              if (ctx && canvas.width > 0 && canvas.height > 0) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngDataUrl = canvas.toDataURL('image/png');
                images[hash] = images[hash] || pngDataUrl;
              } else {
                images[hash] = images[hash] || img;
              }
            } catch {
              images[hash] = images[hash] || img;
            }
          } else {
            images[hash] = images[hash] || img;
          }
        }
      }
      if (!--x) {
        done();
      }
    };
    img.src = url;
  }

  for (let i = 0; i < l; i++) {
    loadImage(imgs[i].getAttribute('src'), imgs[i].width, imgs[i].height);
  }

  // Also preload background images (best-effort; only first url() per element)
  const allEls = element.getElementsByTagName('*');
  for (let i = 0; i < allEls.length; i++) {
    const el = allEls[i] as HTMLElement;
    const bg = getCSS(el)['background-image'];
    if (!bg || bg === 'none') continue;
    const m = bg.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
    if (m && m[2]) {
      loadImage(m[2]);
    }
  }

  if (!x) {
    done();
  }
}

/**
 * Main processing function
 * Ported from old plugin's process function
 */
function process(
  pdf: jsPDF,
  element: HTMLElement | string,
  x: number,
  y: number,
  settings: FromHTMLSettings,
  callback?: (result: { x: number; y: number }) => void
): { x: number; y: number } | undefined {
  if (!element) {
    return undefined;
  }

  // Convert string to DOM element if needed
  let domElement: HTMLElement;
  if (typeof element === 'string') {
    // Create hidden iframe to parse HTML string
    const framename =
      'jsPDFhtmlText' +
      Date.now().toString() +
      Math.random().toString().substring(2, 5);
    const visuallyhidden =
      'position: absolute !important;' +
      'clip: rect(1px 1px 1px 1px);' +
      'clip: rect(1px, 1px, 1px, 1px);' +
      'padding:0 !important;' +
      'border:0 !important;' +
      'height: 1px !important;' +
      'width: 1px !important; ' +
      'top:auto;' +
      'left:-100px;' +
      'overflow: hidden;';

    const hiddendiv = document.createElement('div');
    hiddendiv.style.cssText = visuallyhidden;
    hiddendiv.innerHTML = `<iframe style="height:1px;width:1px" name="${framename}" />`;
    document.body.appendChild(hiddendiv);

    const frame = (window.frames as any)[framename];
    frame.document.open();
    frame.document.writeln(element.replace(/<\/?script[^>]*?>/gi, ''));
    frame.document.close();
    domElement = frame.document.body;
  } else {
    domElement = element;
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const rendererSettings = {
    width: settings.width || pageWidth - x * 2,
  };

  // Store initial X position for table rendering (before renderer is created)
  (pdf as any).initialX = x;

  const r = new Renderer(pdf, x, y, rendererSettings);
  let out: { x: number; y: number } | undefined;

  // Setup element handlers
  const elementHandlers = settings.elementHandlers || {};

  // Load images, then render content
  loadImages(domElement, r, elementHandlers, function (found_images) {
    // Check for footer and set it up
    checkForFooter(domElement, r, elementHandlers);
    
    // Render main content
    try {
      drillForContent(domElement, r, elementHandlers);
      
    } catch (error) {
      console.error('Error during HTML rendering:', error);
    }
    
    // Publish rendering finished event
    pdf.internal.events.publish('htmlRenderingFinished');
    
    out = r.dispose();
    if (typeof callback === 'function') {
      callback(out);
    } else if (found_images) {
      console.error(
        'jsPDF Warning: rendering issues? provide a callback to fromHTML!'
      );
    }
  });

  return out || { x: r.x, y: r.y };
}

/**
 * Converts HTML to PDF
 * Main API function - ported from old plugin's fromHTML
 */
export function fromHTML(
  pdf: jsPDF,
  HTML: HTMLElement | string,
  x?: number,
  y?: number,
  settings?: FromHTMLSettings,
  callback?: (result: { x: number; y: number }) => void,
  margins?: Margins
): { x: number; y: number } | undefined {
  // Set margins
  (pdf as any).margins_doc = margins || {
    top: 0,
    bottom: 0,
  };

  if (!settings) {
    settings = {};
  }
  if (!settings.elementHandlers) {
    settings.elementHandlers = {};
  }

  return process(
    pdf,
    HTML,
    isNaN(x as number) ? 4 : (x as number),
    isNaN(y as number) ? 4 : (y as number),
    settings,
    callback
  );
}
