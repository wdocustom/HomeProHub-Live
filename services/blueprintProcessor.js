/**
 * Blueprint PDF Processing for VisionaryAgent
 * Converts PDF blueprints to images for GPT-4o Vision API analysis
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');

// Try to load canvas - it's optional and may not be available
let createCanvas;
try {
  const canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
} catch (error) {
  console.warn('⚠️  Canvas module not available. Blueprint processing will be limited.');
  console.warn('   To enable full blueprint processing, install system dependencies and rebuild canvas.');
  createCanvas = null;
}

/**
 * Download PDF from URL
 * @param {string} url - URL to PDF file
 * @returns {Buffer} - PDF file buffer
 */
async function downloadPDF(url) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Convert PDF pages to base64 images for Vision API
 * @param {string} pdfUrl - URL to PDF blueprint
 * @param {Object} options - { maxPages: 10, scale: 2.0 }
 * @returns {Array<string>} - Array of base64 data URLs (data:image/png;base64,...)
 */
async function convertPDFToImages(pdfUrl, options = {}) {
  // Check if canvas is available
  if (!createCanvas) {
    throw new Error('Canvas module not available. Cannot process PDF blueprints. Install system dependencies and rebuild canvas package.');
  }

  const { maxPages = 10, scale = 2.0 } = options;

  console.log(`[BlueprintProcessor] Downloading PDF from ${pdfUrl}...`);

  try {
    // Download PDF
    const pdfBuffer = await downloadPDF(pdfUrl);
    console.log(`[BlueprintProcessor] Downloaded ${pdfBuffer.length} bytes`);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0 // Suppress console logs
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, maxPages);

    console.log(`[BlueprintProcessor] Processing ${numPages} of ${pdf.numPages} pages...`);

    const images = [];

    // Convert each page to image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`[BlueprintProcessor] Rendering page ${pageNum}/${numPages}...`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convert to base64 data URL
      const base64Image = canvas.toDataURL('image/png');
      images.push(base64Image);

      console.log(`[BlueprintProcessor] Page ${pageNum} rendered (${Math.round(base64Image.length / 1024)}KB)`);
    }

    console.log(`[BlueprintProcessor] ✅ Converted ${images.length} pages to images`);
    return images;

  } catch (error) {
    console.error('[BlueprintProcessor] Error converting PDF:', error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

/**
 * Validate if URL is a PDF
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isPDFUrl(url) {
  if (!url) return false;

  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');
}

/**
 * Extract PDF metadata
 * @param {string} pdfUrl - URL to PDF
 * @returns {Object} - { title, author, numPages, pageSize }
 */
async function extractPDFMetadata(pdfUrl) {
  try {
    const pdfBuffer = await downloadPDF(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0
    });

    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata();
    const page1 = await pdf.getPage(1);
    const viewport = page1.getViewport({ scale: 1.0 });

    return {
      title: metadata.info?.Title || 'Untitled',
      author: metadata.info?.Author || 'Unknown',
      numPages: pdf.numPages,
      pageSize: {
        width: Math.round(viewport.width),
        height: Math.round(viewport.height)
      },
      creationDate: metadata.info?.CreationDate,
      modificationDate: metadata.info?.ModDate
    };
  } catch (error) {
    console.error('[BlueprintProcessor] Error extracting metadata:', error);
    return null;
  }
}

module.exports = {
  convertPDFToImages,
  isPDFUrl,
  extractPDFMetadata
};
