const EMAIL_FROM = process.env.EMAIL_FROM || 'Waradly <onboarding@resend.dev>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text: body }),
  });
  if (!res.ok) {
    console.error('[email:resend] send failed', res.status, await res.text().catch(() => ''));
  }
}

module.exports = { sendEmail };
