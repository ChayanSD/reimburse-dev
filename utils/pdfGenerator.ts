import puppeteer from "puppeteer";
import { generateHTML, ExpenseReportData } from "./htmlTemplates";

export interface GeneratePDFOptions {
  paperSize?: string;
  userId?: string;
}

export interface PDFResult {
  pdfBuffer: Buffer;
  pdf_url: string;
  pages: number;
  template_used: string;
  filename: string;
  html_content: string;
}

// Enhanced PDF generation using Puppeteer for HTML to PDF conversion
export async function generatePDF(
  data: ExpenseReportData,
  options?: { userId?: string }
): Promise<PDFResult> {
  let browser;
  try {
    // Generate HTML content
    const htmlContent = generateHTML(data);

    // Generate filename
    const userSlug = data.submitter.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const periodStart = new Date(data.reportMeta.period_start);
    const periodStr = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, "0")}`;
    const filename = `reimburseme_${userSlug}_${periodStr}.pdf`;

    // Platform-specific launch arguments for cross-platform compatibility
    const baseArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ];

    // Add platform-specific args
    const platformArgs =
      process.platform === "win32"
        ? [] // Avoid --single-process on Windows as it can cause issues
        : ["--single-process"];

    const launchArgs = [...baseArgs, ...platformArgs];

    // Launch Puppeteer with platform-aware options
    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
    });

    const page = await browser.newPage();

    // Set viewport for better PDF rendering
    await page.setViewport({ width: 1200, height: 800 });

    // Set HTML content with increased timeout for reliability
    await page.setContent(htmlContent, {
      waitUntil: "load",
      timeout: 30000,
    });

    // Emulate print media for better PDF rendering
    await page.emulateMediaType("print");

    // Generate PDF with print-friendly options and timeout
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      timeout: 30000,
    });

    // Convert to Buffer
    const pdfBuffer = Buffer.from(pdfUint8Array);

    // Calculate estimated pages based on content
    const estimatedPages = Math.max(
      1,
      Math.ceil((data.line_items?.length || 0) / 15) +
        1 +
        (data.appendix?.include_receipt_gallery ? 1 : 0)
    );

    // Create data URL for the PDF
    const pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString(
      "base64"
    )}`;

    return {
      pdfBuffer,
      pdf_url: pdfDataUrl,
      pages: estimatedPages,
      template_used: data.branding?.template || "Classic",
      filename,
      html_content: htmlContent,
    };
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw new Error(
      `Failed to generate PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
