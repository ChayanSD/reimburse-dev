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

/**
 * Retry helper for network requests
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delayMs * attempt; // Exponential backoff
        console.warn(`PDF generation attempt ${attempt} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Validate HTML content
 */
function validateHTML(html: string): void {
  if (!html || typeof html !== "string") {
    throw new Error("HTML content is invalid: must be a non-empty string");
  }

  if (html.length === 0) {
    throw new Error("HTML content is empty");
  }

  // Basic HTML structure validation
  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
    throw new Error("HTML content appears to be invalid: missing HTML structure");
  }
}

export async function generatePDF(
  data: ExpenseReportData,
  options?: { userId?: string }
): Promise<PDFResult> {
  try {
    // Step 1: Validate API key exists (with helpful error message)
    const apiKey = process.env.PDFSHIFT_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        "PDFSHIFT_API_KEY environment variable is not set. " +
        "Get your free API key at https://pdfshift.io/ (100 free PDFs/month, no credit card required). " +
        "Then add it to your Vercel environment variables."
      );
    }

    // Step 2: Generate HTML content
    const htmlContent = generateHTML(data);

    // Step 3: Validate HTML content (prevents invalid requests)
    validateHTML(htmlContent);

    // Step 4: Generate filename
    const userSlug = data.submitter.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const periodStart = new Date(data.reportMeta.period_start);
    const periodStr = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, "0")}`;
    const filename = `reimburseme_${userSlug}_${periodStr}.pdf`;

    // Step 5: Generate PDF using PDFShift API with retry logic and timeout
    const pdfBuffer = await retryRequest(async () => {
      // Create AbortController for timeout (6s max to leave 4s buffer for Vercel 10s limit)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: htmlContent,
            format: "A4",
            margin: "0.5in",
            // Only using basic parameters - PDFShift API v3 doesn't support background/wait_until
            // Using minimal options to reduce processing time
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check content type FIRST (before reading body) to catch HTML error pages
        const contentType = response.headers.get("content-type") || "";

        // Handle HTTP errors with specific messages
        if (!response.ok) {
          let errorMessage = `PDFShift API error (${response.status}): `;

          // Clone response to read body without consuming it
          const responseClone = response.clone();

          try {
            const errorData = await responseClone.json();
            errorMessage += errorData.message || errorData.error || JSON.stringify(errorData);
          } catch {
            try {
              const errorText = await responseClone.text();
              errorMessage += errorText || response.statusText;
            } catch {
              errorMessage += response.statusText;
            }
          }

          // Specific error handling for common issues
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              "Invalid PDFShift API key. Please check your PDFSHIFT_API_KEY environment variable. " +
              "Get your free API key at https://pdfshift.io/ and add it to Vercel environment variables."
            );
          } else if (response.status === 429) {
            throw new Error(
              "PDFShift API rate limit exceeded. You've used your free tier limit (100/month). " +
              "Upgrade at https://pdfshift.io/ or wait until next month."
            );
          } else if (response.status === 400) {
            throw new Error(
              `PDFShift API: Invalid request. ${errorMessage}. ` +
              "Please check your HTML content is valid."
            );
          } else if (response.status >= 500) {
            throw new Error(
              `PDFShift API server error (${response.status}). This is temporary - retrying automatically...`
            );
          } else {
            throw new Error(errorMessage);
          }
        }

        // Validate content type - PDFShift should return application/pdf
        // Even if status is 200, check content-type to catch HTML error pages
        if (!contentType.includes("application/pdf") && !contentType.includes("pdf")) {
          // Read the response to see what we got (only if not PDF)
          const responseText = await response.text();
          console.error("PDFShift returned non-PDF content:", {
            contentType,
            status: response.status,
            preview: responseText.substring(0, 500)
          });

          // Check if it's an HTML error page
          if (responseText.includes("<!doctype") || responseText.includes("<html") || contentType.includes("text/html")) {
            throw new Error(
              "PDFShift returned an HTML error page instead of PDF. " +
              "This usually means: 1) Invalid API key, 2) Account limit reached, 3) Service error. " +
              "Please check your PDFShift account at https://pdfshift.io/"
            );
          }

          throw new Error(
            `PDFShift returned ${contentType} instead of PDF. ` +
            "Please check your PDFShift API key and account status."
          );
        }

        // Get PDF buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate PDF was actually generated (check PDF magic number)
        if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "%PDF") {
          // Double-check if it's HTML (shouldn't happen if content-type check worked)
          const bufferStart = buffer.toString("ascii", 0, 100).toLowerCase();
          if (bufferStart.includes("<!doctype") || bufferStart.includes("<html")) {
            const htmlContent = buffer.toString("utf-8");
            console.error("PDFShift returned HTML instead of PDF (bypassed content-type check):", htmlContent.substring(0, 1000));
            throw new Error(
              "PDFShift returned HTML instead of PDF. This usually means: " +
              "1) Invalid API key, 2) Account limit reached, 3) Service error. " +
              "Please check your PDFShift account."
            );
          }
          throw new Error("PDFShift returned invalid PDF data. The response is not a valid PDF file.");
        }

        return buffer;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle timeout specifically
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            "PDF generation timed out after 8 seconds. " +
            "This might be due to slow network or large HTML content. Please try again."
          );
        }

        throw error;
      }
    }, 1, 0); // Only 1 attempt (no retries) to stay under 10s limit

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("PDF generation returned empty result");
    }

    const estimatedPages = Math.max(
      1,
      Math.ceil((data.line_items?.length || 0) / 15) +
        1 +
        (data.appendix?.include_receipt_gallery ? 1 : 0)
    );
  // Step 8: Create data URL for the PDF
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
    if (error instanceof Error) {
      if (error.message.includes("PDFSHIFT_API_KEY") ||
          error.message.includes("PDFShift API") ||
          error.message.includes("HTML content") ||
          error.message.includes("rate limit") ||
          error.message.includes("Invalid PDFShift")) {
        throw error;
      }

      if (error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("AbortError")) {
        throw new Error(
          `Network error during PDF generation: ${error.message}. ` +
          "The request will be retried automatically. If this persists, check your internet connection."
        );
      }

      throw new Error(
        `Failed to generate PDF: ${error.message}. ` +
        "If this persists, verify: 1) PDFSHIFT_API_KEY is set correctly, 2) You haven't exceeded free tier (100/month), 3) Network connection is stable."
      );
    }

    throw new Error(
      `Failed to generate PDF: Unknown error occurred. ` +
      "Please check: 1) PDFSHIFT_API_KEY environment variable is set, 2) You have free tier credits remaining, 3) Your HTML content is valid."
    );
  }
}