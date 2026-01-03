import { generateHTML, ExpenseReportData } from "./htmlTemplates";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Local development fallback
// We use dynamic imports for dev-dependencies to avoid bundling issues in production
const getLocalBrowser = async () => {
  try {
    const { default: puppeteerLocal } = await import("puppeteer");
    return await puppeteerLocal.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  } catch (error) {
    console.error("Failed to launch local puppeteer:", error);
    throw new Error("Failed to launch local browser. Ensure 'puppeteer' is installed in devDependencies.");
  }
};

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

export async function generatePDF(
  data: ExpenseReportData,
  options?: { userId?: string }
): Promise<PDFResult> {
  let browser = null;
  try {
    // Step 1: Generate HTML content
    const htmlContent = generateHTML(data);

    // Step 2: Launch Browser
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      // Configuration for Vercel/Production
      const executablePath = await chromium.executablePath();
      
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath,
        headless: true,
      });
    } else {
      // Local development
      browser = await getLocalBrowser();
    }

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    // Step 3: Create Page & Set Content
    const page = await browser.newPage();
    
    // Set content and wait for network idle to ensure fonts/images load
    await page.setContent(htmlContent, {
      waitUntil: ["load", "networkidle0"],
      timeout: 30000,
    });

    // Step 4: Generate PDF
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
    });

    // Step 5: Process Result
    const pdfBuffer = Buffer.from(pdfUint8Array);

    const userSlug = data.submitter.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    
    // Safety check for date
    const dateStr = data.reportMeta.period_start || new Date().toISOString(); 
    const periodStart = new Date(dateStr);
    
    const periodStr = !isNaN(periodStart.getTime()) 
      ? `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`
      : "report";
      
    const filename = `reimburseme_${userSlug}_${periodStr}.pdf`;

    const estimatedPages = Math.max(
      1,
      Math.ceil((data.line_items?.length || 0) / 15) +
        1 +
        (data.appendix?.include_receipt_gallery ? 1 : 0)
    );

    const pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;

    return {
      pdfBuffer,
      pdf_url: pdfDataUrl,
      pages: estimatedPages,
      template_used: data.branding?.template || "Classic",
      filename,
      html_content: htmlContent,
    };
  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
}