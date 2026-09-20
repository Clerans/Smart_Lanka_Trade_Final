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
 * 1. Send OTP for Email Verification (Ultra-Clean Light Fintech Theme)
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
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #00C853 0%, #00B4D8 50%, #00C853 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 35px 35px 20px 35px; text-align: center;">
              
              <!-- Brand Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 16px auto;">
                <tr>
                  <td style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 30px; padding: 6px 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #047857; letter-spacing: 1.5px; text-transform: uppercase;">
                      ⚡ Institutional Asset Security
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.5px;">
                SmartLanka <span style="color: #00C853;">Trade</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #64748B;">
                Digital Asset & High-Performance Trading Platform
              </p>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 10px 35px 30px 35px; text-align: center;">
              
              <div style="background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0; padding: 28px 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 18px 0; font-size: 14px; color: #334155; line-height: 1.5; font-weight: 500;">
                  Use the 6-digit verification code below to complete your registration and activate your trading account:
                </p>

                <!-- OTP Code Display Box -->
                <div style="background-color: #FFFFFF; border: 2px solid #00C853; border-radius: 12px; padding: 18px 26px; margin: 0 auto 16px auto; display: inline-block; box-shadow: 0 4px 16px rgba(0, 200, 83, 0.12);">
                  <span style="font-family: 'SF Pro Display', -apple-system, 'SF Mono', Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0F172A; padding-left: 10px;">
                    ${otp}
                  </span>
                </div>

                <!-- Expiry Pill -->
                <div style="margin-top: 10px;">
                  <span style="display: inline-block; font-size: 12px; font-weight: 700; color: #047857; background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 20px; padding: 5px 14px;">
                    ⏱️ Valid for 10 minutes
                  </span>
                </div>
              </div>

              <!-- Security Warning Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px; text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #92400E; line-height: 1.5;">
                      <strong>🔒 Security Tip:</strong> Never share this verification code with anyone. SmartLanka Trade staff will never ask for your code or account passwords.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.5;">
                If you did not initiate this registration, please disregard this email.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 35px;">
              <div style="height: 1px; background-color: #F1F5F9; width: 100%;"></div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 35px; text-align: center; background-color: #FAFAFA;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 500;">
                SmartLanka Trade &bull; Colombo, Sri Lanka
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
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
 * 2. Send OTP for Password Reset (Light Theme)
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
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          
          <!-- Top Gradient Accent Bar (Amber/Red for security) -->
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #EA580C 0%, #F59E0B 50%, #EA580C 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 35px 35px 20px 35px; text-align: center;">
              <!-- Brand Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 16px auto;">
                <tr>
                  <td style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 30px; padding: 6px 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #C2410C; letter-spacing: 1.5px; text-transform: uppercase;">
                      🛡️ Password Recovery Request
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.5px;">
                SmartLanka <span style="color: #EA580C;">Trade</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #64748B;">
                Account Recovery & Security Authentication
              </p>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 10px 35px 30px 35px; text-align: center;">
              
              <div style="background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0; padding: 28px 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 18px 0; font-size: 14px; color: #334155; line-height: 1.5; font-weight: 500;">
                  You requested to reset your password. Use the security code below:
                </p>

                <!-- OTP Code Display Card -->
                <div style="background-color: #FFFFFF; border: 2px solid #EA580C; border-radius: 12px; padding: 18px 26px; margin: 0 auto 16px auto; display: inline-block; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.12);">
                  <span style="font-family: 'SF Pro Display', -apple-system, 'SF Mono', Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #EA580C; padding-left: 10px;">
                    ${otp}
                  </span>
                </div>

                <!-- Expiry Pill -->
                <div style="margin-top: 10px;">
                  <span style="display: inline-block; font-size: 12px; font-weight: 700; color: #C2410C; background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 20px; padding: 5px 14px;">
                    ⏱️ Valid for 10 minutes
                  </span>
                </div>
              </div>

              <!-- Security Advice Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px; text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #991B1B; line-height: 1.5;">
                      <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please secure your account credentials immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 35px; text-align: center; background-color: #FAFAFA; border-top: 1px solid #F1F5F9;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 500;">
                SmartLanka Trade &bull; Security Operations Center
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
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
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          <tr><td height="6" style="background: linear-gradient(90deg, #00C853, #00B4D8);"></td></tr>
          <tr>
            <td style="padding: 35px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #0F172A;">Welcome to SmartLanka <span style="color:#00C853;">Trade</span></h1>
              <p style="font-size: 14px; color: #64748B; margin-bottom: 25px;">Please confirm your email address by clicking the activation button below:</p>
              <a href="${url}" style="padding: 14px 32px; background: linear-gradient(135deg, #00C853 0%, #00B4D8 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">Verify My Account &rarr;</a>
              <p style="font-size: 11px; color: #94A3B8; margin-top: 25px; word-break: break-all;">Link: ${url}</p>
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
 * 4. Send Price Alert Email (Light Theme)
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
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          <tr><td height="6" style="background: linear-gradient(90deg, #00C853, #00B4D8);"></td></tr>
          <tr>
            <td style="padding: 35px; text-align: center;">
              <span style="font-size: 32px;">🚀</span>
              <h2 style="margin: 10px 0 5px 0; font-size: 22px; color: #0F172A;">Price Alert Triggered!</h2>
              <p style="font-size: 14px; color: #64748B; margin-bottom: 20px;">Your market trigger for <strong>${symbol}</strong> has been reached.</p>
              
              <div style="background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0; padding: 20px; text-align: left; margin-bottom: 20px;">
                <p style="margin: 6px 0; font-size: 14px; color: #475569;">Symbol: <strong style="color: #0F172A;">${symbol}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #475569;">Target Price: <strong style="color: #00B4D8;">${targetPrice}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #475569;">Current Price: <strong style="color: ${isAbove ? '#00C853' : '#EA580C'};">${currentPrice}</strong></p>
                <p style="margin: 6px 0; font-size: 14px; color: #475569;">Condition: <strong style="color: #0F172A;">${isAbove ? 'Price rose above target' : 'Price fell below target'}</strong></p>
              </div>

              <p style="font-size: 12px; color: #94A3B8;">Log in to SmartLanka Trade to manage active positions.</p>
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
