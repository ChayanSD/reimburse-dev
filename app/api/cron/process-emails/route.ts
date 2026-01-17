import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient, refreshTokens } from "@/lib/google-auth";
import prisma from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";
import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.QSTASH_TOKEN}`) {
    // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.authUser.findMany({
      where: {
        emailConnected: true,
        gmailRefreshToken: { not: null },
      },
      select: {
        id: true,
        email: true,
        gmailAccessToken: true,
        gmailRefreshToken: true,
        gmailTokenExpiresAt: true,
        gmailConnectedAt: true,
      },
    });

    console.log(`[Cron] Found ${users.length} connected users to process.`);
    const results = [];

    for (const user of users) {
      try {
        const userResults = await processUserEmails(user);
        results.push({ userId: user.id, ...(userResults as object) });
      } catch (err) {
        console.error(`Error processing emails for user ${user.id}:`, err);
        results.push({ userId: user.id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function processUserEmails(user: any) {
  const oauth2Client = getOAuthClient();
  let accessToken = user.gmailAccessToken;

  const isExpired = !user.gmailTokenExpiresAt || 
                    new Date(user.gmailTokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired && user.gmailRefreshToken) {
    const newTokens = await refreshTokens(user.gmailRefreshToken);
    accessToken = newTokens.access_token;
    
    await prisma.authUser.update({
      where: { id: user.id },
      data: {
        gmailAccessToken: accessToken,
        gmailTokenExpiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
      },
    });
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: user.gmailRefreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // 1. Calculate a safe 'after' date for the Gmail query (default to 2 days)
  const baseDate = user.gmailConnectedAt ? new Date(user.gmailConnectedAt) : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const formattedDate = baseDate.toISOString().split('T')[0].replace(/-/g, '/');

  // Filter for specific keywords to only get receipts/invoices
  const query = `has:attachment (receipt OR invoice OR bill OR payment OR "factura" OR "pago") after:${formattedDate}`;
  
  console.log(`[Cron] Scanning ${user.email} with query: ${query}`);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 15, // Slightly more results to allow for time-filtering
  });

  const messages = response.data.messages || [];
  console.log(`[Cron] User ${user.email}: Found ${messages.length} potential messages.`);
  let processedCount = 0;
  let skippedCount = 0;

  for (const message of messages) {
    if (!message.id) continue;

    const existing = await prisma.processedEmail.findUnique({
      where: { messageId: message.id },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const msg = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
    });

    // 2. Precise Filtering: Only process if received AFTER the connection timestamp
    const msgDate = new Date(parseInt(msg.data.internalDate || "0"));
    if (user.gmailConnectedAt && msgDate < new Date(user.gmailConnectedAt)) {
      console.log(`[Cron] Skipping old message from ${msgDate.toISOString()}`);
      skippedCount++;
      continue;
    }

    console.log(`[Cron] Processing message ${message.id}: "${msg.data.snippet}"`);
    
    // 3. Find all attachments (Recursive)
    const attachments = findAttachments(msg.data.payload?.parts || []);
    let hasValidAttachment = false;

    for (const attachment of attachments) {
      if (attachment.filename && attachment.body?.attachmentId) {
        const mimeType = attachment.mimeType || "";
        const isImage = mimeType.startsWith("image/");
        const isPDF = mimeType === "application/pdf";

        if (isImage || isPDF) {
          const detail = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: message.id,
            id: attachment.body.attachmentId,
          });

          const data = detail.data.data;
          if (data) {
            console.log(`[Cron] Found valid ${mimeType}: ${attachment.filename}`);
            const buffer = Buffer.from(data, "base64url");
            const fileName = attachment.filename || "attachment";
            const isPDF = mimeType === "application/pdf";
            
            const uploadResult = await new Promise<any>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  folder: "receipts_gmail",
                  resource_type: "auto",
                  public_id: `gmail_${message.id}_${fileName.replace(/\.[^/.]+$/, "")}`,
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              );
              uploadStream.end(buffer);
            });

            // Generate the final image URL for processing
            // For PDFs, this will be the transformed webp/jpg image
            const processUrl = isPDF 
              ? cloudinary.url(uploadResult.public_id, {
                  transformation: [
                    { width: 1000, crop: "scale" },
                    { fetch_format: "webp" },
                    { quality: 100 }
                  ],
                  secure: true
                })
              : uploadResult.secure_url;

            const receipt = await prisma.receipt.create({
              data: {
                userId: user.id,
                fileName: fileName,
                fileUrl: uploadResult.secure_url, // Keep original PDF for download
                merchantName: "Processing Email...",
                amount: 0,
                category: "Other",
                receiptDate: new Date(),
                status: "pending",
              },
            });

            await qstash.publishJSON({
              url: `${process.env.NEXT_PUBLIC_APP_URL}/api/ocr/process`,
              body: {
                receiptId: receipt.id,
                userId: user.id,
                file_url: processUrl, // Send the converted image URL to OCR
                filename: fileName,
              },
            });

            hasValidAttachment = true;
          }
        }
      }
    }

    await prisma.processedEmail.create({
      data: {
        userId: user.id,
        messageId: message.id,
      },
    });

    processedCount++;
  }

  return { processedCount, skippedCount };
}

/**
 * Recursive helper to find attachments in deep message parts
 */
function findAttachments(parts: any[]): any[] {
  let found: any[] = [];
  for (const part of parts) {
    if (part.filename && part.body?.attachmentId) {
      found.push(part);
    } else if (part.parts) {
      found = found.concat(findAttachments(part.parts));
    }
  }
  return found;
}
