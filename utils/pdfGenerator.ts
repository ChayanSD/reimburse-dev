import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { generateHTML, ExpenseReportData } from "./htmlTemplates";

// Remote Chromium executable path for Vercel serverless environment
const remoteExecutablePath =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

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

// Optimized PDF generation for Vercel Hobby plan (10s limit)
// Uses @sparticuz/chromium with headless shell mode for maximum performance
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

    // Configure Chromium for Vercel serverless environment
    // Always use @sparticuz/chromium on Vercel (detected by VERCEL env var)
    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
    
    let executablePath: string | undefined;
    let launchArgs: string[];
    let defaultViewport: { width: number; height: number } | undefined;

    if (isVercel) {
      // On Vercel: Force use of @sparticuz/chromium
      // Get executable path - this MUST work on Vercel
      executablePath = await chromium.executablePath();
      
      if (!executablePath) {
        throw new Error(
          "Failed to get Chromium executable path on Vercel. " +
          "Ensure @sparticuz/chromium is properly installed."
        );
      }

      launchArgs = chromium.args;
      defaultViewport = chromium.defaultViewport;
    } else {
      // Local development: try to find Chrome/Chromium
      const possiblePaths = [
        process.env.CHROMIUM_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
      ].filter(Boolean) as string[];

      for (const path of possiblePaths) {
        try {
          const fs = await import("fs/promises");
          await fs.access(path);
          executablePath = path;
          break;
        } catch {
          continue;
        }
      }

      if (!executablePath) {
        throw new Error(
          "Chrome/Chromium not found for local development. " +
          "Install Chrome or set CHROMIUM_PATH environment variable."
        );
      }

      launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ];
    }

    // Launch Puppeteer with optimized configuration
    // Use 'shell' headless mode for better performance (as per Puppeteer docs)
    // Shell mode is faster and perfect for PDF generation from HTML
    browser = await puppeteer.launch({
      executablePath,
      headless: "shell", // Use shell mode for maximum performance (faster than true)
      args: launchArgs,
      defaultViewport: defaultViewport || { width: 1200, height: 800 },
    });

    console.log("Browser launched", browser.version());

    let page;
    try {
      page = await browser.newPage();

      // Set viewport for PDF rendering
      await page.setViewport({ width: 1200, height: 800 });

      // Set HTML content - optimized for Vercel Hobby (10s limit)
      // Use "domcontentloaded" for fastest rendering (HTML is static, no external resources)
      await page.setContent(htmlContent, {
        waitUntil: "domcontentloaded", // Fastest option for static HTML
        timeout: 8000, // 8s timeout to leave 2s for PDF generation
      });

      // Emulate print media for better PDF rendering
      await page.emulateMediaType("print");

      // Generate PDF - optimized for speed
      // Vercel Hobby has 10s limit, so we need to be fast
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
        timeout: 8000, // 8s timeout for PDF generation
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
    } finally {
      // Ensure page is closed even if PDF generation fails
      if (page) {
        try {
          await page.close();
        } catch (pageError) {
          console.warn("Failed to close page:", pageError);
        }
      }
    }
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
