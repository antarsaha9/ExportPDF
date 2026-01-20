import React, { useState, useRef, useEffect } from 'react';
import { htmlToPdf } from '../src/index';
import './App.css';

function App() {
  const [htmlContent, setHtmlContent] = useState(`<div>
  <h1>Welcome to HTML to PDF Converter</h1>
  <p>This is a simple paragraph with some text content.</p>
  <h2>Features</h2>
  <p>The library can parse HTML tags and extract text content.</p>
  <h3>Supported Tags</h3>
  <p>It supports headings, paragraphs, and other text elements.</p>
  <p><strong>Bold text</strong> and <em>italic text</em> are also supported.</p>
  <h4>Usage</h4>
  <p>Simply provide a DOM element to generate a PDF.</p>
</div>`);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPdfMaximized, setIsPdfMaximized] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const generatePdf = async () => {
    if (!previewRef.current) return;

    setLoading(true);
    try {
      const blob = await htmlToPdf(previewRef.current);
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
              <div
                ref={previewRef}
                className="html-preview"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
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
