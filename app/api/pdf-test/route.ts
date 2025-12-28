import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

export async function POST(req: NextRequest) {
  const data = await req.json();

  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Invoice</h1>
        <p>Name: ${data.name}</p>
        <p>Total: ${data.total}</p>
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless : "shell"
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();

  return NextResponse.json({ pdf });
}
