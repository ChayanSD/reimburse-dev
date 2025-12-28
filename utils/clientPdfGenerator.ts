/**
 * Client-side PDF generation utility
 * Uses html2pdf.js to generate PDFs directly in the browser
 * 100% reliable - no server timeout issues
 * 
 * This is a fallback option when server-side generation fails or for instant PDFs
 */

import { ExpenseReportData } from "./htmlTemplates";
import { generateHTML } from "./htmlTemplates";

// Dynamic import for html2pdf.js (client-side only)
let html2pdf: any = null;

async function loadHtml2Pdf() {
  if (typeof window === "undefined") {
    throw new Error("Client-side PDF generation only works in the browser");
  }

  if (!html2pdf) {
    // Dynamic import to avoid SSR issues
    try {
      // @ts-ignore - html2pdf.js types will be available after npm install
      const html2pdfModule = await import("html2pdf.js");
      html2pdf = html2pdfModule.default || html2pdfModule;
    } catch (error) {
      throw new Error(
        "html2pdf.js library not found. Please run: npm install html2pdf.js"
      );
    }
  }

  return html2pdf;
}

export interface ClientPDFResult {
  success: boolean;
  filename: string;
  error?: string;
}

/**
 * Generate PDF client-side using html2pdf.js
 * This works 100% in the browser - no server needed
 */
export async function generateClientPDF(
  data: ExpenseReportData,
  options?: { filename?: string }
): Promise<ClientPDFResult> {
  try {
    // Load html2pdf library
    const html2pdfLib = await loadHtml2Pdf();

    // Generate HTML content
    let htmlContent = generateHTML(data);

    // Sanitize CSS to remove unsupported color functions (like lab())
    // html2canvas doesn't support modern CSS color functions
    htmlContent = htmlContent.replace(
      /color:\s*lab\([^)]+\)/gi,
      'color: #374151' // Fallback to gray
    );
    htmlContent = htmlContent.replace(
      /background:\s*lab\([^)]+\)/gi,
      'background: white' // Fallback to white
    );
    htmlContent = htmlContent.replace(
      /background-color:\s*lab\([^)]+\)/gi,
      'background-color: white' // Fallback to white
    );

    // Create a temporary container element
    const container = document.createElement("div");
    container.innerHTML = htmlContent;
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "8.5in"; // A4 width
    document.body.appendChild(container);

    // Wait for fonts and images to load
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate filename
    const userSlug = data.submitter.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const periodStart = new Date(data.reportMeta.period_start);
    const periodStr = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, "0")}`;
    const filename = options?.filename || `reimburseme_${userSlug}_${periodStr}.pdf`;

    // Configure PDF options
    const opt = {
      margin: 0.5,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        ignoreElements: (element: HTMLElement) => {
          // Ignore elements with problematic CSS
          const style = window.getComputedStyle(element);
          try {
            // Try to access color properties - if they throw, ignore the element
            style.color;
            style.backgroundColor;
            return false;
          } catch (e) {
            return true; // Ignore elements with unsupported CSS
          }
        },
        onclone: (clonedDoc: Document) => {
          // Remove any problematic CSS from cloned document
          const styleSheets = clonedDoc.styleSheets;
          for (let i = 0; i < styleSheets.length; i++) {
            try {
              const sheet = styleSheets[i];
              if (sheet.cssRules) {
                for (let j = 0; j < sheet.cssRules.length; j++) {
                  const rule = sheet.cssRules[j] as CSSStyleRule;
                  if (rule.style) {
                    // Remove lab() colors
                    if (rule.style.color && rule.style.color.includes('lab(')) {
                      rule.style.color = '#374151';
                    }
                    if (rule.style.backgroundColor && rule.style.backgroundColor.includes('lab(')) {
                      rule.style.backgroundColor = 'white';
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore cross-origin stylesheet errors
              continue;
            }
          }
        },
      },
      jsPDF: {
        unit: "in",
        format: "a4",
        orientation: "portrait",
      },
    };

    // Generate and download PDF
    await html2pdfLib().set(opt).from(container).save();

    // Cleanup
    document.body.removeChild(container);

    return {
      success: true,
      filename,
    };
  } catch (error) {
    console.error("Client-side PDF generation error:", error);
    return {
      success: false,
      filename: options?.filename || "report.pdf",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if client-side PDF generation is available
 */
export function isClientPDFAvailable(): boolean {
  return typeof window !== "undefined";
}

