import nodemailer from 'nodemailer';
import { google } from 'googleapis';

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function buildHtml(args: { title: string; body: string; actionUrl?: string }) {
  const safeTitle = String(args.title ?? '');
  const safeBody = String(args.body ?? '').replace(/\n/g, '<br/>');
  const actionUrl = args.actionUrl ? String(args.actionUrl) : '';
  const hasAction = !!actionUrl;
  return `
  <div style="margin:0;padding:0;background:#07090f;color:#e5e7eb;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:38px;height:38px;border-radius:10px;background:#2563eb;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(37,99,235,0.35);">
          <span style="font-weight:800;color:#fff;letter-spacing:-0.3px;">evo</span>
        </div>
        <div style="line-height:1.1;">
          <div style="font-weight:700;color:#fff;">Evo.OS</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">Notificación</div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px 18px 16px;">
        <div style="font-size:18px;font-weight:800;color:#fff;margin:0 0 10px 0;">${safeTitle}</div>
        <div style="font-size:14px;line-height:1.6;color:rgba(229,231,235,0.82);margin:0;">${safeBody}</div>
        ${
          hasAction
            ? `<div style="margin-top:16px;">
                 <a href="${actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700;">
                   Ver en Evo.OS
                 </a>
               </div>`
            : ''
        }
      </div>

      <div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,0.35);">
        Si no reconoces esta notificación, puedes ignorar este correo.
      </div>
    </div>
  </div>
  `.trim();
}

export async function sendNotificationEmail(
  to: string,
  title: string,
  body: string,
  actionUrl?: string
): Promise<void> {
  try {
    const clientId = env('GOOGLE_CLIENT_ID');
    const clientSecret = env('GOOGLE_CLIENT_SECRET');
    const refreshToken = env('GOOGLE_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('[emailService] Missing Google OAuth env vars.');
      return;
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });

    const accessToken = await oauth2.getAccessToken();
    const at = typeof accessToken === 'string' ? accessToken : accessToken?.token;
    if (!at) {
      console.error('[emailService] Could not obtain access token.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: env('GMAIL_SENDER') ?? env('GOOGLE_SENDER_EMAIL') ?? env('EMAIL_FROM') ?? env('GOOGLE_EMAIL') ?? env('GOOGLE_USER_EMAIL') ?? env('GOOGLE_USER') ?? '',
        clientId,
        clientSecret,
        refreshToken,
        accessToken: at,
      },
    });

    const fromUser = env('GMAIL_SENDER') ?? env('GOOGLE_SENDER_EMAIL') ?? env('EMAIL_FROM') ?? env('GOOGLE_EMAIL') ?? env('GOOGLE_USER_EMAIL') ?? env('GOOGLE_USER') ?? '';
    if (!fromUser) {
      console.error('[emailService] Missing sender email (set GMAIL_SENDER or similar).');
      return;
    }

    await transporter.sendMail({
      from: `Evo.OS <${fromUser}>`,
      to,
      subject: title,
      html: buildHtml({ title, body, actionUrl }),
    });
  } catch (err: unknown) {
    console.error('[emailService] sendNotificationEmail error:', (err as Error).message);
    return;
  }
}

