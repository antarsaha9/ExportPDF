# HTML to PDF Library

A TypeScript library that converts HTML DOM elements to PDF documents. **Browser-only** implementation using native DOM APIs.

## Features

- Parse HTML DOM elements and extract text content from various HTML tags
- Generate PDF documents with proper formatting
- Support for headings (h1-h6), paragraphs, bold, italic, and other text elements
- Automatic page breaks and text wrapping
- TypeScript support with full type definitions
- React-based development preview with side-by-side HTML and PDF comparison

## Installation

```bash
npm install
```

## Dependencies

- `jspdf` - PDF generation
- `react` - Development preview UI (dev dependency)
- `vite` - Development server (dev dependency)
- `typescript` - TypeScript compiler

## Usage

### Basic Example

```typescript
import { htmlToPdf } from './src/index';

// Get a DOM element
const element = document.getElementById('my-content');

// Generate PDF as Blob
const blob = await htmlToPdf(element);

// Download the PDF
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'output.pdf';
link.click();
URL.revokeObjectURL(url);
```

### HTML Example

See `examples/simple.html` for a complete working example in the browser.

## Development Preview

The project includes a React-based development preview that shows HTML and generated PDF side-by-side.

### Start Development Server

```bash
npm run dev
```

This will:
- Start a Vite dev server on `http://localhost:3000`
- Open the preview application in your browser
- Show HTML editor, HTML preview, and generated PDF side-by-side
- Allow you to edit HTML and see the PDF update in real-time

The preview application includes:
- **HTML Editor**: Edit HTML content
- **HTML Preview**: See how the HTML is rendered
- **PDF Preview**: View the generated PDF
- **Generate PDF Button**: Convert the HTML to PDF
- **Download PDF Button**: Download the generated PDF

## API

### `htmlToPdf(element: HTMLElement): Promise<Blob>`

Converts a DOM element to a PDF Blob.

**Parameters:**
- `element` - DOM element (HTMLElement) to convert

**Returns:** Promise that resolves with a Blob containing the PDF data

### `parseElement(element: HTMLElement): TextNode[]`

Parses a DOM element and extracts text nodes with tag information.

**Parameters:**
- `element` - DOM element to parse

**Returns:** Array of text nodes containing tag name, text content, and children

### `extractAllText(element: HTMLElement): string[]`

Extracts all text content from a DOM element, flattening the structure.

**Parameters:**
- `element` - DOM element to parse

**Returns:** Array of text strings

### `createPdfFromNodes(nodes: TextNode[]): jsPDF`

Creates a PDF document from text nodes.

**Returns:** jsPDF document instance

### `pdfToBlob(doc: jsPDF): Blob`

Converts a jsPDF document to a Blob for browser download.

**Returns:** Blob containing PDF data

## Supported HTML Tags

The library supports various HTML tags with appropriate formatting:

- **Headings**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6` (with different font sizes and bold styling)
- **Paragraphs**: `p` (standard text)
- **Text formatting**: `strong`, `b` (bold), `em`, `i` (italic)
- **Other text elements**: Any tag containing text will be processed

## Project Structure

```
ExportPDF/
├── package.json
├── tsconfig.json
├── tsconfig.lib.json      # Library build config
├── vite.config.ts         # Vite configuration
├── index.html             # Dev preview entry
├── .gitignore
├── src/
│   ├── htmlParser.ts      # DOM parsing logic
│   ├── pdfGenerator.ts    # PDF generation logic
│   └── index.ts           # Main export module
├── dev/
│   ├── main.tsx           # React app entry
│   ├── App.tsx            # Preview application
│   ├── App.css            # Styles
│   └── index.css          # Global styles
├── examples/
│   └── simple.html        # Browser example
└── README.md
```

## Building

### Build Library

To compile the TypeScript library to JavaScript:

```bash
npm run build
```

The compiled files will be in the `dist/` directory.

### Build Dev Preview

The dev preview uses Vite and doesn't require a separate build step. Run `npm run dev` to start the development server.

## Browser Compatibility

This library is designed for **browser environments only**. It uses:
- Native DOM APIs for HTML parsing
- jsPDF for PDF generation (browser-compatible)
- ES modules for modern browser support

## License

MIT


<!-- https://github.com/parallax/jsPDF/blob/v1.4.1/plugins/from_html.js -->