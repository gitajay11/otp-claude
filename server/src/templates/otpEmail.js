/**
 * Themed OTP email (dark / neon), built with tables + inline styles so it
 * renders consistently across Gmail, Outlook, Apple Mail, etc.
 */

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderOtpEmail({ appName, code, purpose, firstName, expiresInMinutes }) {
  const app = escapeHtml(appName);
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  const action = purpose === 'signup' ? 'complete your sign-up' : 'log in to your account';
  const subject = purpose === 'signup' ? `Verify your email for ${appName}` : `Your ${appName} login code`;

  const digitCells = code
    .split('')
    .map(
      (d) => `
        <td style="padding:0 4px;">
          <div style="width:46px;height:58px;line-height:58px;text-align:center;font-family:${MONO};font-size:30px;font-weight:700;color:#00f0ff;background:#0d1426;border:1px solid #1f3b57;border-radius:10px;box-shadow:0 0 18px rgba(0,240,255,0.25);">${d}</div>
        </td>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0e1a;">
  <!-- Preheader (inbox preview text); deliberately does not contain the code -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your one-time verification code expires in ${expiresInMinutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0e1a;background-image:radial-gradient(circle at 20% 0%, rgba(139,92,246,0.18), transparent 50%),radial-gradient(circle at 80% 100%, rgba(0,240,255,0.12), transparent 50%);">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <!-- Brand -->
          <tr>
            <td style="padding:0 4px 18px;font-family:${MONO};font-size:13px;letter-spacing:3px;color:#00f0ff;text-transform:uppercase;">
              &#x2B22;&nbsp; ${app}<span style="color:#8b5cf6;">//</span>auth
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#0f1526;border:1px solid rgba(0,240,255,0.28);border-radius:18px;padding:36px 32px;box-shadow:0 0 40px rgba(0,240,255,0.12);">
              <div style="font-family:${MONO};font-size:13px;color:#8b5cf6;margin-bottom:10px;">&gt; verification_requested<span style="color:#00f0ff;">_</span></div>
              <h1 style="margin:0 0 16px;font-family:${SANS};font-size:22px;line-height:1.3;font-weight:700;color:#f1f5f9;">Your verification code</h1>
              <p style="margin:0 0 6px;font-family:${SANS};font-size:15px;line-height:1.6;color:#cbd5e1;">${greeting}</p>
              <p style="margin:0 0 26px;font-family:${SANS};font-size:15px;line-height:1.6;color:#cbd5e1;">Use the code below to ${action}.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 26px;">
                <tr>${digitCells}</tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
                <tr>
                  <td align="center" style="font-family:${MONO};font-size:13px;color:#fbbf24;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;padding:10px 14px;">
                    &#x23F1; This code expires in ${expiresInMinutes} minutes
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:#94a3b8;">
                Never share this code with anyone — ${app} staff will never ask for it.
                If you didn't request it, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 8px 0;font-family:${MONO};font-size:11px;color:#64748b;letter-spacing:1px;">
              automated message · do not reply
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting}`,
    '',
    `Use this code to ${action}: ${code}`,
    '',
    `It expires in ${expiresInMinutes} minutes. Never share it with anyone.`,
    "If you didn't request this code, you can ignore this email.",
    '',
    `— ${appName}`,
  ].join('\n');

  return { subject, html, text };
}
