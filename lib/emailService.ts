import transport from "./nodemailer";

interface EmailData {
  to: string;
  merchantName: string;
  amount: number;
  category: string;
  receiptDate: string;
  fileName: string;
}

export async function sendProcessingCompleteEmail(
  emailData: EmailData
): Promise<boolean> {
  try {
    const { to, merchantName, amount, category, receiptDate, fileName } =
      emailData;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Processing Complete</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
          }
          .container {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 32px;
            text-align: center;
          }
          .logo-container {
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px;
          }
          .logo img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
          }
          .content {
            padding: 40px 32px;
          }
          .success-badge {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
          }
          .intro-text {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.7;
          }
          .receipt-card {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border-radius: 12px;
            padding: 28px;
            margin: 32px 0;
            border: 1px solid #e5e7eb;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          .detail-row:first-child {
            padding-top: 0;
          }
          .detail-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 600;
            font-size: 15px;
            text-align: right;
          }
          .amount-highlight {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 24px;
            font-weight: 700;
          }
          .info-text {
            font-size: 15px;
            color: #4b5563;
            margin: 24px 0;
            line-height: 1.7;
          }
          .cta-container {
            text-align: center;
            margin: 32px 0;
          }
          .cta-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 20px -3px rgba(102, 126, 234, 0.5);
          }
          .footer {
            background-color: #f9fafb;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.6;
          }
          .footer-brand {
            font-weight: 600;
            color: #667eea;
          }
          @media (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 32px 24px;
            }
            .content {
              padding: 32px 24px;
            }
            .header-title {
              font-size: 24px;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 8px;
            }
            .detail-value {
              text-align: left;
            }
            .receipt-card {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <div class="logo">
                  <img src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/" alt="ReimburseMe Logo" />
                </div>
              </div>
              <h1 class="header-title">Processing Complete!</h1>
              <p class="header-subtitle">Your receipt has been successfully analyzed</p>
            </div>
            
            <div class="content">
              <div class="success-badge">
                Successfully Processed
              </div>
              
              <p class="intro-text">
                Great news! Your receipt has been successfully processed and all information has been extracted. Review the details below to ensure everything looks correct.
              </p>
              
              <div class="receipt-card">
                <div class="detail-row">
                  <span class="detail-label">Merchant Name :</span>
                  <span class="detail-value">${merchantName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount :</span>
                  <span class="detail-value amount-highlight">$${amount.toFixed(
                    2
                  )}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Category :</span>
                  <span class="detail-value">${category}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date :</span>
                  <span class="detail-value">${receiptDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">File Name :</span>
                  <span class="detail-value">${fileName}</span>
                </div>
              </div>
              
              <p class="info-text">
                You can now review and edit the extracted information in your dashboard. If anything needs adjustment, simply click the button below to access your expense details.
              </p>
              
              <div class="cta-container">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                }/dashboard" class="cta-button">
                  View in Dashboard →
                </a>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                This email was sent from <span class="footer-brand">ReimburseMe</span>
              </p>
              <p class="footer-text">
                Your smart receipt processing solution
              </p>
              <p class="footer-text" style="margin-top: 16px;">
                Questions? Contact our support team anytime.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "ReimburseMe",
        address: process.env.APP_EMAIL || "noreply@reimburseme.com",
      },
      to,
      subject: "✓ Your receipt processing is complete!",
      html: emailHtml,
    };

    await transport.sendMail(mailOptions);
    console.log("Processing complete email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Failed to send processing complete email:", error);
    return false;
  }
}

export async function sendProcessingFailedEmail(emailData: {
  to: string;
  fileName: string;
  errorMessage?: string;
}): Promise<boolean> {
  try {
    const { to, fileName, errorMessage } = emailData;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Processing Issue</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
          }
          .container {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .header {
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            padding: 48px 32px;
            text-align: center;
          }
          .logo-container {
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px;
          }
          .logo img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
          }
          .content {
            padding: 40px 32px;
          }
          .error-badge {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);
          }
         
          .intro-text {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.7;
          }
          .info-card {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
          }
          .info-title {
            font-weight: 700;
            color: #92400e;
            font-size: 16px;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-icon {
            font-size: 20px;
          }
          .info-text {
            color: #78350f;
            margin: 0;
            line-height: 1.7;
            font-size: 15px;
          }
          .file-info {
            background-color: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin: 24px 0;
            border: 1px solid #e5e7eb;
          }
          .file-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .file-name {
            color: #1f2937;
            font-weight: 600;
            font-size: 15px;
            word-break: break-all;
          }
          .help-text {
            font-size: 15px;
            color: #4b5563;
            margin: 24px 0;
            line-height: 1.7;
          }
          .cta-container {
            text-align: center;
            margin: 32px 0;
          }
          .cta-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 20px -3px rgba(102, 126, 234, 0.5);
          }
          .footer {
            background-color: #f9fafb;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.6;
          }
          .footer-brand {
            font-weight: 600;
            color: #667eea;
          }
          @media (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 32px 24px;
            }
            .content {
              padding: 32px 24px;
            }
            .header-title {
              font-size: 24px;
            }
            .info-card {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <div class="logo">
                  <img src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/" alt="ReimburseMe Logo" />
                </div>
              </div>
              <h1 class="header-title">Processing Issue</h1>
              <p class="header-subtitle">We encountered a problem with your receipt</p>
            </div>
            
            <div class="content">
              <div class="error-badge">
                Processing Failed
              </div>
              
              <p class="intro-text">
                We encountered an issue while automatically processing your receipt. Don't worry – you can still add this expense manually and we'll help you through the process.
              </p>
              
              <div class="info-card">
                <h3 class="info-title">
                  <span class="info-icon">⚠️</span>
                  What happened?
                </h3>
                <p class="info-text">
                  ${
                    errorMessage ||
                    "The automated OCR system was unable to extract information from your receipt. This can happen with low-quality images, unusual receipt formats, or faded text."
                  }
                </p>
              </div>
              
              <div class="file-info">
                <div class="file-label">Failed File</div>
                <div class="file-name">${fileName}</div>
              </div>
              
              <p class="help-text">
                You can manually enter the receipt details in your dashboard. The original file will be attached to your expense for your records.
              </p>
              
              <div class="cta-container">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                }/upload" class="cta-button">
                  Try Again →
                </a>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                This email was sent from <span class="footer-brand">ReimburseMe</span>
              </p>
              <p class="footer-text">
                Your smart receipt processing solution
              </p>
              <p class="footer-text" style="margin-top: 16px;">
                Having issues? Our support team is here to help!
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "ReimburseMe",
        address: process.env.APP_EMAIL || "noreply@reimburseme.com",
      },
      to,
      subject: "⚠️ Receipt processing issue - Manual entry available",
      html: emailHtml,
    };

    await transport.sendMail(mailOptions);
    console.log("Processing failed email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Failed to send processing failed email:", error);
    return false;
  }
}

export async function sendOTPEmail(emailData: {
  to: string;
  otp: string;
}): Promise<boolean> {
  try {
    const { to, otp } = emailData;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
          }
          .container {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 32px;
            text-align: center;
          }
          .logo-container {
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px;
          }
          .logo img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
          }
          .content {
            padding: 40px 32px;
          }
          .otp-container {
            text-align: center;
            margin: 32px 0;
          }
          .otp-code {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border: 2px dashed #667eea;
            border-radius: 12px;
            padding: 24px;
            display: inline-block;
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            margin: 16px 0;
            box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.1);
          }
          .intro-text {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 24px;
            line-height: 1.7;
            text-align: center;
          }
          .warning-text {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 24px 0;
            font-size: 14px;
            color: #92400e;
          }
          .footer {
            background-color: #f9fafb;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.6;
          }
          .footer-brand {
            font-weight: 600;
            color: #667eea;
          }
          @media (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 32px 24px;
            }
            .content {
              padding: 32px 24px;
            }
            .header-title {
              font-size: 24px;
            }
            .otp-code {
              font-size: 28px;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <div class="logo">
                  <img src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/" alt="ReimburseMe Logo" />
                </div>
              </div>
              <h1 class="header-title">Password Reset</h1>
              <p class="header-subtitle">Your one-time password</p>
            </div>

            <div class="content">
              <p class="intro-text">
                We received a request to reset your password. Use the code below to complete the reset process.
              </p>

              <div class="otp-container">
                <div class="otp-code">${otp}</div>
              </div>

              <div class="warning-text">
                <strong>Important:</strong> This code will expire in 5 minutes. Do not share this code with anyone.
              </div>
            </div>

            <div class="footer">
              <p class="footer-text">
                This email was sent from <span class="footer-brand">ReimburseMe</span>
              </p>
              <p class="footer-text">
                If you didn't request a password reset, please ignore this email.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "ReimburseMe",
        address: process.env.APP_EMAIL || "noreply@reimburseme.com",
      },
      to,
      subject: "🔐 Your Password Reset Code",
      html: emailHtml,
    };

    await transport.sendMail(mailOptions);
    console.log("OTP email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}

export async function sendVerificationEmail(emailData: {
  to: string;
  firstName: string;
  verificationToken: string;
}): Promise<boolean> {
  try {
    const { to, firstName, verificationToken } = emailData;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/account/verify-email?token=${verificationToken}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - ReimburseMe</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
          }
          .container {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 32px;
            text-align: center;
          }
          .logo-container {
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px;
          }
          .logo img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
          }
          .content {
            padding: 40px 32px;
          }
          .welcome-badge {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
          }
          .intro-text {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.7;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
          }
          .info-card {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-left: 4px solid #667eea;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
          }
          .info-title {
            font-weight: 700;
            color: #1e40af;
            font-size: 16px;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-icon {
            font-size: 20px;
          }
          .info-text {
            color: #1e3a8a;
            margin: 0;
            line-height: 1.7;
            font-size: 15px;
          }
          .cta-container {
            text-align: center;
            margin: 32px 0;
          }
          .cta-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 20px -3px rgba(102, 126, 234, 0.5);
          }
          .footer {
            background-color: #f9fafb;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.6;
          }
          .footer-brand {
            font-weight: 600;
            color: #667eea;
          }
          @media (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 32px 24px;
            }
            .content {
              padding: 32px 24px;
            }
            .header-title {
              font-size: 24px;
            }
            .info-card {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <div class="logo">
                  <img src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/" alt="ReimburseMe Logo" />
                </div>
              </div>
              <h1 class="header-title">Welcome to ReimburseMe!</h1>
              <p class="header-subtitle">Please verify your email address</p>
            </div>
            
            <div class="content">
              <div class="welcome-badge">
                ✓ Account Created Successfully
              </div>
              
              <div class="greeting">Hi ${firstName}!</div>
              
              <p class="intro-text">
                Thank you for signing up for ReimburseMe! We're excited to help you manage your expenses efficiently.
              </p>
              
              <div class="info-card">
                <h3 class="info-title">
                  <span class="info-icon">📧</span>
                  Verify Your Email
                </h3>
                <p class="info-text">
                  To complete your registration and start using ReimburseMe, please click the button below to verify your email address. This helps us ensure the security of your account.
                </p>
              </div>
              
              <div class="cta-container">
                <a href="${verificationUrl}" class="cta-button">
                  Verify Email Address →
                </a>
              </div>
              
              <p class="intro-text" style="font-size: 14px; margin-top: 24px;">
                If the button doesn't work, you can copy and paste this link into your browser:<br>
                <span style="color: #667eea; word-break: break-all;">${verificationUrl}</span>
              </p>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                This email was sent from <span class="footer-brand">ReimburseMe</span>
              </p>
              <p class="footer-text">
                Your smart receipt processing solution
              </p>
              <p class="footer-text" style="margin-top: 16px;">
                If you didn't create this account, please ignore this email.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "ReimburseMe",
        address: process.env.APP_EMAIL || "noreply@reimburseme.com",
      },
      to,
      subject: "Welcome to ReimburseMe! Please verify your email",
      html: emailHtml,
    };

    await transport.sendMail(mailOptions);
    console.log("Verification email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}
