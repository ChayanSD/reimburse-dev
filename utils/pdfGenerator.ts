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

/**
 * Generate PDF using PDFShift API (100 free PDFs/month, no credit card required)
 * Optimized for Vercel Hobby plan with comprehensive error handling
 * 
 * Free tier: 100 PDFs/month
 * Get API key: https://pdfshift.io/ (free, no credit card)
 */
export async function generatePDF(
  data: ExpenseReportData,
  options?: { userId?: string }
): Promise<PDFResult> {
  try {
    // Step 1: Validate API key exists (with helpful error message)
    const apiKey = "sk_b4c0fc737016d51781d70fcdbac6aa6447324e59";
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        "PDFSHIFT_API_KEY environment variable is not set. " +
        "Get your free API key at https://pdfshift.io/ (100 free PDFs/month, no credit card required). " +
        "For local development: Add PDFSHIFT_API_KEY=your_key to .env.local file and restart the dev server. " +
        "For Vercel: Add it in Project Settings → Environment Variables."
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
      // Create AbortController for timeout (8s max for Vercel Hobby)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        console.log("[PDF] Starting PDF generation request to PDFShift...");
        console.log("[PDF] API key length:", apiKey?.length || 0);
        console.log("[PDF] API key prefix:", apiKey?.substring(0, 10) || "none");
        console.log("[PDF] HTML content length:", htmlContent.length);
        
        // PDFShift API: Use X-API-Key header (updated authentication method)
        let response: Response;
        try {
          response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
            method: "POST",
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
              "Accept": "application/pdf",
              "User-Agent": "ReimburseApp/1.0",
            },
            body: JSON.stringify({
              source: htmlContent,
              format: "A4",
              margin: "0.5in",
            }),
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("[PDF] Fetch error:", fetchError);
          if (fetchError instanceof Error) {
            throw new Error(`Network error calling PDFShift API: ${fetchError.message}`);
          }
          throw new Error("Network error calling PDFShift API: Unknown error");
        }

        clearTimeout(timeoutId);

        console.log(`[PDF] PDFShift response status: ${response.status}`);
        console.log(`[PDF] PDFShift response headers:`, Object.fromEntries(response.headers.entries()));

        // Handle HTTP errors with specific messages
        if (!response.ok) {
          let errorMessage = `PDFShift API error (${response.status}): `;
          let errorDetails: any = null;
          
          try {
            const contentType = response.headers.get("content-type");
            console.log(`[PDF] Error response content-type:`, contentType);
            
            if (contentType?.includes("application/json")) {
              errorDetails = await response.json();
              console.error(`[PDF] PDFShift JSON error response:`, errorDetails);
              errorMessage += errorDetails.message || errorDetails.error || errorDetails.detail || JSON.stringify(errorDetails);
            } else {
              const errorText = await response.text();
              console.error(`[PDF] PDFShift text error response:`, errorText);
              errorMessage += errorText || response.statusText;
            }
          } catch (parseError) {
            console.error(`[PDF] Error parsing error response:`, parseError);
            errorMessage += response.statusText || "Unknown error";
          }

          console.error(`[PDF] PDFShift API error (final):`, errorMessage);

          // Specific error handling for common issues
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              `Invalid PDFShift API key (${response.status}). ` +
              "Please verify your PDFSHIFT_API_KEY environment variable is correct. " +
              "Get your free API key at https://pdfshift.io/ and add it to Vercel environment variables."
            );
          } else if (response.status === 429) {
            throw new Error(
              "PDFShift API rate limit exceeded. You've used your free tier limit (100/month). " +
              "Upgrade at https://pdfshift.io/ or wait until next month."
            );
          } else if (response.status === 400) {
            throw new Error(
              `PDFShift API: Invalid request (400). ${errorMessage}. ` +
              "Please check your HTML content is valid and properly formatted."
            );
          } else if (response.status >= 500) {
            throw new Error(
              `PDFShift API server error (${response.status}). This is temporary - retrying automatically...`
            );
          } else {
            throw new Error(`PDFShift API error: ${errorMessage}`);
          }
        }

        // Get PDF buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`[PDF] Received PDF buffer, size: ${buffer.length} bytes`);
        
        // Validate PDF was actually generated (check PDF magic number)
        if (buffer.length < 4) {
          throw new Error("PDFShift returned empty or invalid response");
        }
        
        const pdfHeader = buffer.toString("ascii", 0, 4);
        if (pdfHeader !== "%PDF") {
          console.error(`[PDF] Invalid PDF header: ${pdfHeader} (expected %PDF)`);
          throw new Error(
            `PDFShift returned invalid PDF data. Expected PDF file but got: ${pdfHeader.substring(0, 50)}...`
          );
        }
        
        console.log("[PDF] PDF generation successful!");
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
        
        // Re-throw with more context
        if (error instanceof Error) {
          console.error(`[PDF] PDF generation error:`, error.message);
        }
        
        throw error;
      }
    }, 3, 1000); // 3 retries with 1s, 2s, 3s delays

    // Step 6: Validate PDF was generated
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("PDF generation returned empty result");
    }

    // Step 7: Calculate estimated pages
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
    // Enhanced error handling with clear messages
    if (error instanceof Error) {
      // Re-throw with enhanced context if it's already a well-formed error
      if (error.message.includes("PDFSHIFT_API_KEY") || 
          error.message.includes("PDFShift API") ||
          error.message.includes("HTML content") ||
          error.message.includes("rate limit") ||
          error.message.includes("Invalid PDFShift")) {
        throw error;
      }
      
      // Network/timeout errors (with retry suggestion)
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
      
      // Generic error with helpful context
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
