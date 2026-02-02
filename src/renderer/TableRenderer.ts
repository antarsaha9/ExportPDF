import { jsPDF } from 'jspdf';
import { Renderer } from './Renderer';
import { ParsedCSS } from '../types';
import { getCSS } from '../parser/cssParser';
import { normalizeUnicode } from '../utils/unicode';

/**
 * Table header structure
 */
interface TableHeader {
  name: string;
  prompt: string;
  width: number;
}

/**
 * Table data structure
 */
interface TableData {
  rows: Array<Record<string, string>>;
  headers: TableHeader[];
}

/**
 * Converts HTML table to JSON structure
 * Ported from old plugin's tableToJson function
 */
export function tableToJson(table: HTMLTableElement, renderer: Renderer): TableData {
  const data: Array<Record<string, string>> = [];
  const headers: TableHeader[] = [];
  
  if (table.rows.length === 0) {
    return { rows: data, headers: headers };
  }

  const tableWidth = table.clientWidth || renderer.pdf.internal.pageSize.getWidth();
  const pageWidth = renderer.pdf.internal.pageSize.getWidth();
  
  // Extract headers from first row
  const firstRow = table.rows[0];
  const headerCells = firstRow.cells;
  
  for (let i = 0; i < headerCells.length; i++) {
    const cell = headerCells[i];
    headers[i] = {
      name: normalizeUnicode(cell.textContent || '').toLowerCase().replace(/\s+/g, '') || `col${i}`,
      prompt: normalizeUnicode(cell.textContent || '').replace(/\r?\n/g, ''),
      width: tableWidth > 0 
        ? (cell.clientWidth / tableWidth) * pageWidth
        : pageWidth / headerCells.length
    };
  }

  // Extract data rows (skip first row if it was used as header)
  for (let i = 1; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    const rowData: Record<string, string> = {};
    
    for (let j = 0; j < tableRow.cells.length && j < headers.length; j++) {
      const cell = tableRow.cells[j];
      rowData[headers[j].name] = normalizeUnicode(cell.textContent || '').replace(/\r?\n/g, '');
    }
    
    data.push(rowData);
  }

  return {
    rows: data,
    headers: headers
  };
}

/**
 * Renders a table to PDF
 * Implements table rendering since pdf.table() is not available in modern jsPDF
 */
export function renderTable(
  table: HTMLTableElement,
  renderer: Renderer,
  elementHandlers: any
): void {
  const tableData = tableToJson(table, renderer);
  const css = getCSS(table);
  
  if (tableData.headers.length === 0 && tableData.rows.length === 0) {
    return;
  }

  // Move down a bit before table
  renderer.y += 10;

  const startY = renderer.y;
  const pageWidth = renderer.pdf.internal.pageSize.getWidth();
  const margins = (renderer.pdf as any).margins_doc || { top: 0, bottom: 0 };
  
  // Determine left margin: use margins_doc.left if explicitly set, otherwise use renderer.x (initial position)
  // For tables, we want to start at the left margin, not at current renderer.x position
  // Store initial x if not already stored
  if (!(renderer.pdf as any).initialX) {
    (renderer.pdf as any).initialX = renderer.x;
  }
  const initialX = (renderer.pdf as any).initialX;
  const marginLeft = margins.left !== undefined ? margins.left : initialX;
  // Right margin should match left margin if not explicitly set (symmetrical margins)
  // This ensures tables don't extend beyond the right edge
  const marginRight = margins.right !== undefined ? margins.right : marginLeft;
  
  // Calculate available width for table
  // Available width = page width - left margin - right margin
  const maxRightX = pageWidth - marginRight;
  const availableWidth = Math.max(0, maxRightX - marginLeft);
  
  // Debug logging (can be removed later)
  // console.log('Table margins:', { marginLeft, marginRight, pageWidth, maxRightX, availableWidth });
  
  // Calculate column widths based on available width
  const totalHeaderWidth = tableData.headers.reduce((sum, h) => sum + h.width, 0);
  const colWidths = tableData.headers.map(h => 
    totalHeaderWidth > 0 ? (h.width / totalHeaderWidth) * availableWidth : availableWidth / tableData.headers.length
  );
  
  // Calculate total table width (sum of all column widths)
  const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);

  const rowHeight = 8;
  const headerHeight = 10;
  const cellPadding = 2;
  
  // Check if we need a new page
  const estimatedHeight = headerHeight + (tableData.rows.length * rowHeight);
  const pageHeight = renderer.pdf.internal.pageSize.getHeight();
  
  if (renderer.y + estimatedHeight > pageHeight - margins.bottom) {
    renderer.pdf.addPage();
    renderer.y = margins.top;
  }

  let currentY = renderer.y;
  // Use left margin as starting position (not renderer.x, which might have moved)
  let currentX = marginLeft;
  
  // Ensure table doesn't exceed right margin
  if (currentX + totalTableWidth > maxRightX) {
    // Adjust table width to fit
    const adjustedWidth = maxRightX - currentX;
    if (adjustedWidth > 0) {
      // Recalculate column widths proportionally
      const scaleFactor = adjustedWidth / totalTableWidth;
      for (let i = 0; i < colWidths.length; i++) {
        colWidths[i] = colWidths[i] * scaleFactor;
      }
    } else {
      console.warn('Table too wide for page, skipping table render');
      return;
    }
  }
  
  // Recalculate total table width after adjustment
  const finalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  
  // Ensure all values are valid numbers
  if (isNaN(currentX) || isNaN(currentY) || isNaN(finalTableWidth) || finalTableWidth <= 0) {
    console.warn('Invalid table dimensions, skipping table render');
    return;
  }

  // Render header
  if (tableData.headers.length > 0) {
    renderer.pdf.setFontSize(10);
    renderer.pdf.setFont('helvetica', 'bold');
    
    // Draw header background and border
    renderer.pdf.setDrawColor(200, 200, 200);
    renderer.pdf.setFillColor(240, 240, 240);
    renderer.pdf.setLineWidth(0.5);
    
    // Ensure valid dimensions - use 'DF' style (draw then fill) or separate calls
    if (finalTableWidth > 0 && headerHeight > 0 && !isNaN(currentX) && !isNaN(currentY)) {
      try {
        renderer.pdf.rect(currentX, currentY, finalTableWidth, headerHeight, 'DF');
      } catch (e) {
        // Fallback: draw fill and stroke separately
        renderer.pdf.rect(currentX, currentY, finalTableWidth, headerHeight, 'F');
        renderer.pdf.rect(currentX, currentY, finalTableWidth, headerHeight, 'S');
      }
    }
    
    // Draw header text
    let xPos = currentX;
    for (let i = 0; i < tableData.headers.length; i++) {
      const header = tableData.headers[i];
      const cellWidth = colWidths[i];
      
      // Draw cell border
      if (i > 0) {
        renderer.pdf.line(xPos, currentY, xPos, currentY + headerHeight);
      }
      
      // Draw header text
      const headerText = header.prompt || '';
      const lines = renderer.pdf.splitTextToSize(headerText, cellWidth - cellPadding * 2);
      renderer.pdf.text(lines[0] || '', xPos + cellPadding, currentY + 7, {
        maxWidth: cellWidth - cellPadding * 2,
        align: 'left'
      });
      
      xPos += cellWidth;
    }
    
    currentY += headerHeight;
  }

  // Render rows
  renderer.pdf.setFont('helvetica', 'normal');
  renderer.pdf.setFontSize(9);
  renderer.pdf.setTextColor(0, 0, 0); // Ensure text is black
  renderer.pdf.setFillColor(255, 255, 255); // White background
  
  for (let rowIndex = 0; rowIndex < tableData.rows.length; rowIndex++) {
    const row = tableData.rows[rowIndex];
    
    // Check for page break
    if (currentY + rowHeight > pageHeight - margins.bottom) {
      renderer.pdf.addPage();
      currentY = margins.top || 0;
      // Reset X position on new page to left margin
      currentX = marginLeft;
      
      // Redraw header on new page if printHeaders is true
      if (elementHandlers.printHeaders !== false && tableData.headers.length > 0) {
        renderer.pdf.setFontSize(10);
        renderer.pdf.setFont('helvetica', 'bold');
        renderer.pdf.setTextColor(0, 0, 0); // Black text
        renderer.pdf.setFillColor(240, 240, 240); // Light gray background
        // Recalculate table width for new page (should match finalTableWidth)
        const newPageTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
        if (newPageTableWidth > 0 && headerHeight > 0 && !isNaN(currentX) && !isNaN(currentY)) {
          try {
            renderer.pdf.rect(currentX, currentY, newPageTableWidth, headerHeight, 'DF');
          } catch (e) {
            renderer.pdf.rect(currentX, currentY, newPageTableWidth, headerHeight, 'F');
            renderer.pdf.rect(currentX, currentY, newPageTableWidth, headerHeight, 'S');
          }
        }
        
        let xPos = currentX;
        for (let i = 0; i < tableData.headers.length; i++) {
          const header = tableData.headers[i];
          const cellWidth = colWidths[i];
          if (i > 0) {
            renderer.pdf.line(xPos, currentY, xPos, currentY + headerHeight);
          }
          const headerText = header.prompt || '';
          const lines = renderer.pdf.splitTextToSize(headerText, cellWidth - cellPadding * 2);
          renderer.pdf.text(lines[0] || '', xPos + cellPadding, currentY + 7, {
            maxWidth: cellWidth - cellPadding * 2,
            align: 'left'
          });
          xPos += cellWidth;
        }
        currentY += headerHeight;
        renderer.pdf.setFont('helvetica', 'normal');
        renderer.pdf.setFontSize(9);
        renderer.pdf.setTextColor(0, 0, 0); // Reset text color to black
        renderer.pdf.setFillColor(255, 255, 255); // Reset fill to white
      }
    }
    
    // Draw row background and border
    // IMPORTANT: Set fill color before drawing rectangle
    renderer.pdf.setFillColor(255, 255, 255); // White background for each row
    renderer.pdf.setDrawColor(200, 200, 200); // Gray border
    
    const rowTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
    if (rowTableWidth > 0 && rowHeight > 0 && !isNaN(currentX) && !isNaN(currentY)) {
      try {
        // Draw filled rectangle first, then border
        renderer.pdf.rect(currentX, currentY, rowTableWidth, rowHeight, 'F');
        renderer.pdf.rect(currentX, currentY, rowTableWidth, rowHeight, 'S');
      } catch (e) {
        // Fallback
        renderer.pdf.rect(currentX, currentY, rowTableWidth, rowHeight, 'F');
        renderer.pdf.rect(currentX, currentY, rowTableWidth, rowHeight, 'S');
      }
    }
    
    // IMPORTANT: Set text color before drawing text
    renderer.pdf.setTextColor(0, 0, 0); // Black text
    
    // Draw cell content
    let xPos = currentX;
    for (let i = 0; i < tableData.headers.length; i++) {
      const header = tableData.headers[i];
      const cellWidth = colWidths[i];
      const cellValue = row[header.name] || '';
      
      // Draw cell border (vertical line between cells)
      if (i > 0) {
        renderer.pdf.setDrawColor(200, 200, 200);
        renderer.pdf.line(xPos, currentY, xPos, currentY + rowHeight);
      }
      
      // Draw cell text
      if (cellValue) {
        const lines = renderer.pdf.splitTextToSize(cellValue, cellWidth - cellPadding * 2);
        renderer.pdf.text(lines[0] || '', xPos + cellPadding, currentY + 6, {
          maxWidth: cellWidth - cellPadding * 2,
          align: 'left'
        });
      }
      
      xPos += cellWidth;
    }
    
    currentY += rowHeight;
  }

  // Update renderer position
  renderer.y = currentY + 20;
  
  // Store last cell position (for compatibility with old plugin)
  const lastTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  (renderer.pdf as any).lastCellPos = {
    x: currentX,
    y: currentY - rowHeight,
    w: lastTableWidth,
    h: rowHeight
  };
}
