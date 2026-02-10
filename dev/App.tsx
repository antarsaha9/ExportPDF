import React, { useState, useRef, useEffect, useCallback } from 'react';
import { htmlToPdf, woffToTtf, FontDefinition } from '../src/index';
import './App.css';

interface LoadedFont {
  family: string;
  style: 'normal' | 'bold' | 'italic' | 'bolditalic';
  src: string;
  filename: string;
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const ROBOTO_REGULAR_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf';
const ROBOTO_BOLD_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf';

function App() {
  const [htmlContent, setHtmlContent] = useState(`<div>
  <h1>Loading test cases...</h1>
  <p>Please wait while the comprehensive test HTML is loaded.</p>
</div>`);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPdfMaximized, setIsPdfMaximized] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Custom fonts state
  const [customFonts, setCustomFonts] = useState<LoadedFont[]>([]);
  const [fontLoading, setFontLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample.html as default test case from public directory
  useEffect(() => {
    fetch('/sample.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load sample.html');
        }
        return response.text();
      })
      .then(html => {
        // Extract content from body tag
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Extract just the main div content if it exists, otherwise use body content
        const mainDiv = doc.body.querySelector('div');
        if (mainDiv) {
          setHtmlContent(mainDiv.outerHTML);
        } else {
          setHtmlContent(doc.body.innerHTML);
        }
      })
      .catch(error => {
        console.error('Error loading sample.html:', error);
        // Fallback to simple content if file can't be loaded
        setHtmlContent(`<div>
          <h1>Welcome to HTML to PDF Converter</h1>
          <p>Error loading sample.html. Using default content.</p>
          <p>Make sure sample.html is in the public directory.</p>
        </div>`);
      });
  }, []);

  const loadRoboto = useCallback(async () => {
    setFontLoading(true);
    try {
      const [regular, bold] = await Promise.all([
        fetchFontAsBase64(ROBOTO_REGULAR_URL),
        fetchFontAsBase64(ROBOTO_BOLD_URL),
      ]);
      setCustomFonts(prev => [
        ...prev.filter(f => f.family !== 'Roboto'),
        { family: 'Roboto', style: 'normal', src: regular, filename: 'Roboto-Regular.ttf' },
        { family: 'Roboto', style: 'bold', src: bold, filename: 'Roboto-Bold.ttf' },
      ]);

      // Also load into the browser so the iframe preview shows the font
      const regularFace = new FontFace('Roboto', `url(${ROBOTO_REGULAR_URL})`, { weight: '400' });
      const boldFace = new FontFace('Roboto', `url(${ROBOTO_BOLD_URL})`, { weight: '700' });
      await Promise.all([regularFace.load(), boldFace.load()]);
      document.fonts.add(regularFace);
      document.fonts.add(boldFace);
    } catch (err) {
      console.error('Failed to load Roboto:', err);
      alert('Failed to load Roboto font. Check console.');
    } finally {
      setFontLoading(false);
    }
  }, []);

  const handleFontUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setFontLoading(true);
    try {
      for (const file of Array.from(files)) {
        const isWoff = file.name.toLowerCase().endsWith('.woff');
        const isTtf = file.name.toLowerCase().endsWith('.ttf');
        if (!isTtf && !isWoff) {
          alert(`Skipped "${file.name}" — only .ttf and .woff files are supported.`);
          continue;
        }

        let base64: string;
        if (isWoff) {
          // Convert WOFF → TTF, then to base64
          const woffBuffer = await file.arrayBuffer();
          const ttfBuffer = await woffToTtf(woffBuffer);
          base64 = arrayBufferToBase64(ttfBuffer);
        } else {
          base64 = await fileToBase64(file);
        }

        // Derive family name from filename (e.g. "OpenSans-Bold.ttf" → "OpenSans")
        const baseName = file.name.replace(/\.(ttf|woff)$/i, '');
        const lowerName = baseName.toLowerCase();
        let style: LoadedFont['style'] = 'normal';
        let family = baseName;
        if (lowerName.includes('bolditalic') || lowerName.includes('bold-italic')) {
          style = 'bolditalic';
          family = baseName.replace(/[-_]?bold[-_]?italic/i, '');
        } else if (lowerName.includes('bold')) {
          style = 'bold';
          family = baseName.replace(/[-_]?bold/i, '');
        } else if (lowerName.includes('italic')) {
          style = 'italic';
          family = baseName.replace(/[-_]?italic/i, '');
        } else {
          family = baseName.replace(/[-_]?regular/i, '');
        }
        if (!family) family = baseName;

        setCustomFonts(prev => [...prev, { family, style, src: base64, filename: file.name }]);
      }
    } catch (err) {
      console.error('Font upload error:', err);
    } finally {
      setFontLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeFont = useCallback((index: number) => {
    setCustomFonts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const generatePdf = async () => {
    if (!previewRef.current) return;

    setLoading(true);
    try {
      // Get the iframe's document body for PDF generation
      const iframe = previewRef.current;
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument || !iframeDocument.body) {
        throw new Error('Unable to access iframe content');
      }

      const fonts: FontDefinition[] = customFonts.map(f => ({
        family: f.family,
        src: f.src,
        style: f.style,
      }));

      const blob = await htmlToPdf(iframeDocument.body, fonts.length ? { fonts } : undefined);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'output.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Update iframe content when htmlContent changes
  useEffect(() => {
    if (!previewRef.current) return;

    const iframe = previewRef.current;
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) return;

    // Write the HTML content to the iframe
    iframeDocument.open();
    iframeDocument.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    iframeDocument.close();
  }, [htmlContent]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="app">
      <header className="header">
        <h1>HTML to PDF Converter - Preview</h1>
        <div className="controls">
          <button onClick={generatePdf} disabled={loading}>
            {loading ? 'Generating...' : 'Generate PDF'}
          </button>
          {pdfUrl && (
            <button onClick={downloadPdf}>Download PDF</button>
          )}
        </div>
      </header>

      <div className="font-section">
        <div className="font-controls">
          <h2>Custom Fonts</h2>
          <div className="font-actions">
            <button onClick={loadRoboto} disabled={fontLoading}>
              {fontLoading ? 'Loading...' : 'Load Roboto (Google Fonts)'}
            </button>
            <label className="upload-btn">
              Upload .ttf / .woff
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttf,.woff"
                multiple
                onChange={handleFontUpload}
                hidden
              />
            </label>
          </div>
        </div>
        {customFonts.length > 0 && (
          <div className="font-list">
            {customFonts.map((font, i) => (
              <span key={i} className="font-tag">
                {font.family} ({font.style})
                <button className="font-remove" onClick={() => removeFont(i)}>&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="editor-section">
        <div className="editor-panel">
          <h2>HTML Editor</h2>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="html-editor"
            placeholder="Enter your HTML here..."
          />
        </div>
      </div>

      <div className={`preview-section ${isPdfMaximized ? 'pdf-maximized' : ''}`}>
        {!isPdfMaximized && (
          <div className="preview-panel">
            <h2>HTML Preview</h2>
            <div className="preview-container">
              <iframe
                ref={previewRef}
                className="html-preview"
                title="HTML Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        <div className={`pdf-panel ${isPdfMaximized ? 'maximized' : ''}`}>
          <div className="pdf-panel-header">
            <h2>Generated PDF</h2>
            {pdfUrl && (
              <button
                className="maximize-btn"
                onClick={() => setIsPdfMaximized(!isPdfMaximized)}
                title={isPdfMaximized ? 'Restore' : 'Maximize'}
              >
                {isPdfMaximized ? '↗' : '⛶'}
              </button>
            )}
          </div>
          <div className="pdf-container">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="pdf-viewer"
                title="PDF Preview"
              />
            ) : (
              <div className="pdf-placeholder">
                <p>Click "Generate PDF" to see the preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
