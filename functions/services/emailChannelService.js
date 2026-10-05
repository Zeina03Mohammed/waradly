const EMAIL_FROM = process.env.EMAIL_FROM || 'Waradly <onboarding@resend.dev>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const URL_RE = /(https?:\/\/[^\s]+)/g;

/** HTML twin of a plain-text email body: branded header, real clickable links, and the first link
 * promoted to a button. Sending text + HTML together also scores better with spam filters than
 * text-only. */
function toHtml(subject, body) {
  const firstUrl = (body.match(URL_RE) || [])[0];
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${p.replace(URL_RE, '<a href="$1" style="color:#ad7d3c;word-break:break-all;">$1</a>').replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button = firstUrl
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(firstUrl)}" style="display:inline-block;background:#c8964f;color:#0a1220;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">Open link</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#0e1826;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0a1220;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">WARADLY</td></tr>
<tr><td style="padding:28px;font-size:15px;"><h1 style="font-size:19px;margin:0 0 16px;">${escapeHtml(subject)}</h1>${paragraphs}${button}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #dde4ed;color:#5b6f8a;font-size:12px;">Waradly — B2B procurement marketplace. You received this email because of activity on your Waradly account.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Port of src/lib/notifications/{resend,console,index}.ts — same factory-by-env-var pattern:
 * real Resend delivery when RESEND_API_KEY is set, console logging otherwise (dev/emulator). */
async function sendEmail({ to, subject, body }) {
  if (!RESEND_API_KEY) {
    console.log(`[email:console] to=${to} subject="${subject}"\n${body}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text: body, html: toHtml(subject, body) }),
  });
  if (!res.ok) {
    console.error('[email:resend] send failed', res.status, await res.text().catch(() => ''));
  }
}

/** Resend's shared onboarding@resend.dev sender only delivers to the Resend account owner, so
 * until a real domain is verified there, auth emails (verify / reset) go through Firebase Auth's
 * own mailer instead — see auth.routes.js. */
const usesFirebaseAuthMailer = !RESEND_API_KEY || EMAIL_FROM.includes('@resend.dev');

module.exports = { sendEmail, usesFirebaseAuthMailer };
