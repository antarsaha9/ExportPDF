import React, { useState, useRef, useEffect } from 'react';
import { htmlToPdf } from '../src/index';
import './App.css';

function App() {
  const [htmlContent, setHtmlContent] = useState(`<div>
  <h1>Loading test cases...</h1>
  <p>Please wait while the comprehensive test HTML is loaded.</p>
</div>`);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPdfMaximized, setIsPdfMaximized] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

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
      
      const blob = await htmlToPdf(iframeDocument.body);
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
