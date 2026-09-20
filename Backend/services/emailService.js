require('dotenv').config({ quiet: true });

/**
 * Get configured Brevo sender details
 */
const getSender = () => {
  return {
    name: 'SmartLanka Trade',
    email: process.env.BREVO_SENDER || 'no-reply@smartlankatrade.com'
  };
};

/**
 * Diagnostic check on startup to verify Brevo configuration
 */
const verifyEmailService = async () => {
  console.log('🔍 [Email Service Diagnostics]');
  console.log('- Provider: Brevo Transactional Email HTTP API (Native Fetch)');

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER;

  const hasApiKey = !!apiKey && apiKey.length > 5;
  const hasSender = !!senderEmail;

  console.log(`- Brevo API key configured: ${hasApiKey ? 'yes' : 'no'}`);
  console.log(`- Brevo Sender configured: ${hasSender ? `yes (${senderEmail})` : 'no'}`);

  if (!hasApiKey) {
    console.warn('⚠️ BREVO_API_KEY is missing in environment variables.');
    return false;
  }
  if (!hasSender) {
    console.warn('⚠️ BREVO_SENDER is missing in environment variables.');
    return false;
  }

  return true;
};

/**
 * Core email dispatch using Node.js built-in fetch calling Brevo API v3
 * Never logs the API key or OTP values in plaintext
 */
const dispatchBrevoEmail = async ({ to, subject, htmlContent, logLabel = 'Email' }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    const configErr = new Error('BREVO_API_KEY environment variable is not configured.');
    configErr.code = 'EMAIL_CONFIG_MISSING';
    configErr.status = 503;
    throw configErr;
  }

  const sender = getSender();
  const recipients = Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }];

  const payload = {
    sender,
    to: recipients,
    subject,
    htmlContent
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Log the HTTP status code and response body, NEVER logging the API key or OTP
      console.error(`❌ [Brevo API Error] ${logLabel} failed with HTTP status ${response.status}:`, errorBody);
      
      const dispatchErr = new Error(`Email delivery failed via Brevo API (HTTP ${response.status})`);
      dispatchErr.code = 'EMAIL_SEND_FAILED';
      dispatchErr.status = 503;
      dispatchErr.brevoStatus = response.status;
      throw dispatchErr;
    }

    const data = await response.json();
    console.log(`✅ [Brevo API] ${logLabel} delivered successfully to ${recipients.map(r => r.email).join(', ')} (Message ID: ${data?.messageId || 'sent'})`);
    return { success: true, messageId: data?.messageId || 'sent' };
  } catch (error) {
    if (error.code === 'EMAIL_CONFIG_MISSING' || error.code === 'EMAIL_SEND_FAILED') {
      throw error;
    }
    console.error(`❌ [Brevo Exception] ${logLabel} network or parse exception:`, error.message);
    const genericErr = new Error('Email delivery could not be completed at this time.');
    genericErr.code = 'EMAIL_SEND_FAILED';
    genericErr.status = 503;
    throw genericErr;
  }
};

/**
 * 1. Send OTP for Email Verification (Ultra-Premium Fintech Design)
 */
const sendVerificationOTPEmail = async (email, otp) => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartLanka Trade - Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07090E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #07090E; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #0F141E; border-radius: 16px; border: 1px solid #1E2838; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #00C853 0%, #00E5FF 50%, #00C853 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 35px 35px 20px 35px; text-align: center;">
              <!-- Brand Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 15px auto;">
                <tr>
                  <td style="background-color: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: 30px; padding: 6px 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #00E5FF; letter-spacing: 1.5px; text-transform: uppercase;">
                      ⚡ Institutional Asset Security
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                SmartLanka <span style="color: #00E5FF;">Trade</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #7E8B9F;">
                Digital Asset & High-Performance Trading Platform
              </p>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 10px 35px 30px 35px; text-align: center;">
              
              <div style="background-color: #141B28; border-radius: 12px; border: 1px solid #232E42; padding: 25px 20px; margin-bottom: 25px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #94A3B8; line-height: 1.5;">
                  Use the following one-time verification code to activate and secure your trading account:
                </p>

                <!-- OTP Code Display Card -->
                <div style="background: linear-gradient(180deg, #0A0E17 0%, #060910 100%); border: 1px solid #00E5FF; border-radius: 12px; padding: 18px 24px; margin: 0 auto 16px auto; display: inline-block; box-shadow: 0 0 25px rgba(0, 229, 255, 0.15);">
                  <span style="font-family: 'SF Pro Display', -apple-system, 'SF Mono', Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #00E5FF; padding-left: 10px; text-shadow: 0 0 15px rgba(0, 229, 255, 0.4);">
                    ${otp}
                  </span>
                </div>

                <!-- Expiry Pill -->
                <div style="margin-top: 10px;">
                  <span style="display: inline-block; font-size: 12px; font-weight: 600; color: #00C853; background-color: rgba(0, 200, 83, 0.1); border: 1px solid rgba(0, 200, 83, 0.25); border-radius: 20px; padding: 4px 12px;">
                    ⏱️ Valid for 10 minutes
                  </span>
                </div>
              </div>

              <!-- Security Advice Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 12px 16px; text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #FCA5A5; line-height: 1.5;">
                      <strong>🔒 Security Tip:</strong> Never share this code with anyone. SmartLanka Trade staff will never request your verification code or credentials.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                If you did not initiate this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 35px;">
              <div style="height: 1px; background-color: #1E2838; width: 100%;"></div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 25px 35px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">
                SmartLanka Trade &bull; Colombo, Sri Lanka
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} SmartLanka Trade Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'SmartLanka Trade - Email Verification Code',
    htmlContent,
    logLabel: 'Verification OTP Email'
  });
};

/**
 * 2. Send OTP for Password Reset (Ultra-Premium Fintech Design)
 */
const sendPasswordResetOTPEmail = async (email, otp) => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartLanka Trade - Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07090E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #07090E; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #0F141E; border-radius: 16px; border: 1px solid #1E2838; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Top Gradient Accent Bar (Amber/Red for security alert) -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #FF5722 0%, #FF9800 50%, #FF5722 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 35px 35px 20px 35px; text-align: center;">
              <!-- Brand Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 15px auto;">
                <tr>
                  <td style="background-color: rgba(255, 87, 34, 0.1); border: 1px solid rgba(255, 87, 34, 0.3); border-radius: 30px; padding: 6px 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #FF5722; letter-spacing: 1.5px; text-transform: uppercase;">
                      🛡️ Password Recovery Request
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                SmartLanka <span style="color: #FF5722;">Trade</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #7E8B9F;">
                Account Recovery & Security Authentication
              </p>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 10px 35px 30px 35px; text-align: center;">
              
              <div style="background-color: #141B28; border-radius: 12px; border: 1px solid #232E42; padding: 25px 20px; margin-bottom: 25px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #94A3B8; line-height: 1.5;">
                  You requested to reset your password. Use the verification code below:
                </p>

                <!-- OTP Code Display Card -->
                <div style="background: linear-gradient(180deg, #0A0E17 0%, #060910 100%); border: 1px solid #FF5722; border-radius: 12px; padding: 18px 24px; margin: 0 auto 16px auto; display: inline-block; box-shadow: 0 0 25px rgba(255, 87, 34, 0.15);">
                  <span style="font-family: 'SF Pro Display', -apple-system, 'SF Mono', Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #FF5722; padding-left: 10px; text-shadow: 0 0 15px rgba(255, 87, 34, 0.4);">
                    ${otp}
                  </span>
                </div>

                <!-- Expiry Pill -->
                <div style="margin-top: 10px;">
                  <span style="display: inline-block; font-size: 12px; font-weight: 600; color: #FF9800; background-color: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.25); border-radius: 20px; padding: 4px 12px;">
                    ⏱️ Valid for 10 minutes
                  </span>
                </div>
              </div>

              <!-- Security Advice Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 12px 16px; text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #FCA5A5; line-height: 1.5;">
                      <strong>⚠️ Security Notice:</strong> If you did NOT request a password reset, someone may be attempting to access your account. Please change your password immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 25px 35px; text-align: center; border-top: 1px solid #1E2838;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">
                SmartLanka Trade &bull; Security Operations Center
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} SmartLanka Trade Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'SmartLanka Trade - Password Reset Code',
    htmlContent,
    logLabel: 'Password Reset OTP Email'
  });
};

/**
 * 3. Send Verification Link Email (Fallback Link mechanism)
 */
const sendVerificationEmail = async (email, token) => {
  const baseUrl = process.env.BASE_URL || 'https://smart-lanka-trade-final.onrender.com';
  const url = `${baseUrl}/api/auth/verify/${token}`;
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Verify Your SmartLanka Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07090E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #07090E; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #0F141E; border-radius: 16px; border: 1px solid #1E2838; overflow: hidden;">
          <tr><td height="5" style="background: linear-gradient(90deg, #00C853, #00E5FF);"></td></tr>
          <tr>
            <td style="padding: 35px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #FFFFFF;">Welcome to SmartLanka <span style="color:#00E5FF;">Trade</span></h1>
              <p style="font-size: 14px; color: #94A3B8; margin-bottom: 25px;">Please confirm your email address by clicking the activation button below:</p>
              <a href="${url}" style="padding: 14px 32px; background: linear-gradient(135deg, #00C853 0%, #00E5FF 100%); color: #07090E; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">Verify My Account &rarr;</a>
              <p style="font-size: 11px; color: #64748B; margin-top: 25px; word-break: break-all;">Link: ${url}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'Verify Your SmartLanka Account',
    htmlContent,
    logLabel: 'Verification Link Email'
  });
};

/**
 * 4. Send Price Alert Email
 */
const sendPriceAlertEmail = async (email, symbol, targetPrice, currentPrice, alertType) => {
  const isAbove = alertType === 'ABOVE';
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SmartLanka Trade Price Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07090E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #07090E; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #0F141E; border-radius: 16px; border: 1px solid #1E2838; overflow: hidden;">
          <tr><td height="5" style="background: linear-gradient(90deg, #00C853, #00E5FF);"></td></tr>
          <tr>
            <td style="padding: 35px; text-align: center;">
              <span style="font-size: 32px;">🚀</span>
              <h2 style="margin: 10px 0 5px 0; font-size: 22px; color: #FFFFFF;">Price Alert Triggered!</h2>
              <p style="font-size: 14px; color: #94A3B8; margin-bottom: 20px;">Your market trigger for <strong>${symbol}</strong> has been reached.</p>
              
              <div style="background-color: #141B28; border-radius: 10px; border: 1px solid #232E42; padding: 20px; text-align: left; margin-bottom: 20px;">
                <p style="margin: 6px 0; font-size: 14px; color: #94A3B8;">Symbol: <strong style="color: #FFFFFF;">${symbol}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #94A3B8;">Target Price: <strong style="color: #00E5FF;">${targetPrice}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #94A3B8;">Current Price: <strong style="color: ${isAbove ? '#00C853' : '#FF5722'};">${currentPrice}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #94A3B8;">Condition: <strong style="color: #FFFFFF;">${isAbove ? 'Price rose above target' : 'Price fell below target'}</strong></p>
              </div>

              <p style="font-size: 12px; color: #64748B;">Log in to SmartLanka Trade to manage active positions.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: `🚀 Price Alert: ${symbol} hit ${targetPrice}`,
    htmlContent,
    logLabel: 'Price Alert Email'
  });
};

module.exports = {
  verifyEmailService,
  verifyTransporter: verifyEmailService,
  dispatchBrevoEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
  sendVerificationEmail,
  sendPriceAlertEmail
};
