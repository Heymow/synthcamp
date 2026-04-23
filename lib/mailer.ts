import nodemailer, { type Transporter } from 'nodemailer';

export function isMailerConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Fire-and-forget email send. Swallows errors internally so a failing SMTP
 * transaction never bubbles up to block a user action. Logs to console so
 * failures surface in Railway logs.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  if (!isMailerConfigured()) {
    console.warn('[mailer] skipping email (SMTP not configured):', subject);
    return;
  }
  const from = process.env.SMTP_ADMIN_EMAIL
    ? `${process.env.SMTP_SENDER_NAME ?? 'SynthCamp'} <${process.env.SMTP_ADMIN_EMAIL}>`
    : process.env.SMTP_USER;
  try {
    const transporter = getTransporter();
    await transporter.sendMail({ from, to, subject, html, text });
  } catch (err) {
    console.error('[mailer] send failed:', err);
  }
}

interface ReleasePublishedPayload {
  artistName: string;
  artistSlug: string | null;
  releaseTitle: string;
  releaseSlug: string;
}

interface PartyReminderPayload {
  partyId: string;
  artistName: string;
  releaseTitle: string;
  roomName: string;
  scheduledAt: string;
  minutesUntilStart: number;
}

export function renderPartyReminderEmail(p: PartyReminderPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthcamp.net';
  const partyUrl = `${appUrl}/party/${p.partyId}`;
  const when = new Date(p.scheduledAt).toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  const subject = `Starts in ${p.minutesUntilStart} min — ${p.releaseTitle}`;
  const text = `${p.artistName}'s listening party "${p.releaseTitle}" starts in ${p.minutesUntilStart} minutes on ${p.roomName}.\n\nJoin: ${partyUrl}\n\n— SynthCamp`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px 24px;background:#050507;color:#f5f5f7;">
      <p style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#f87171;margin:0 0 24px;">Starts in ${p.minutesUntilStart} min</p>
      <h1 style="font-size:26px;font-weight:900;font-style:italic;text-transform:uppercase;margin:0 0 6px;color:#ffffff;">${p.releaseTitle}</h1>
      <p style="font-size:13px;color:#a5b4fc;margin:0 0 6px;letter-spacing:.15em;text-transform:uppercase;font-weight:700;">by ${p.artistName}</p>
      <p style="font-size:12px;color:#9ca3af;margin:0 0 24px;">on ${p.roomName} · ${when} UTC</p>
      <a href="${partyUrl}" style="display:inline-block;background:#ffffff;color:#000;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:900;font-size:11px;letter-spacing:.15em;text-transform:uppercase;">Join now</a>
      <p style="font-size:10px;color:#6b7280;margin:32px 0 0;">You're getting this because you tapped Wait on this party. Unsubscribe by tapping Waiting again on ${partyUrl}.</p>
    </div>
  `;
  return { subject, html, text };
}

export function renderReleasePublishedEmail(p: ReleasePublishedPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthcamp.net';
  const releaseUrl = `${appUrl}/r/${p.releaseSlug}`;
  const artistUrl = p.artistSlug ? `${appUrl}/artist/${p.artistSlug}` : appUrl;
  const subject = `${p.artistName} just dropped ${p.releaseTitle}`;
  const text = `${p.artistName} released ${p.releaseTitle}.\n\nListen: ${releaseUrl}\nProfile: ${artistUrl}\n\n— SynthCamp`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px 24px;background:#050507;color:#f5f5f7;">
      <p style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#818cf8;margin:0 0 24px;">Synthcamp</p>
      <h1 style="font-size:26px;font-weight:900;font-style:italic;text-transform:uppercase;margin:0 0 12px;color:#ffffff;">${p.releaseTitle}</h1>
      <p style="font-size:13px;color:#9ca3af;margin:0 0 24px;">New release from <a href="${artistUrl}" style="color:#a5b4fc;text-decoration:none;">${p.artistName}</a>, an artist you follow.</p>
      <a href="${releaseUrl}" style="display:inline-block;background:#ffffff;color:#000;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:900;font-size:11px;letter-spacing:.15em;text-transform:uppercase;">Listen now</a>
      <p style="font-size:10px;color:#6b7280;margin:32px 0 0;">You're getting this because you follow ${p.artistName} on SynthCamp. Manage your follows at ${appUrl}/settings/profile.</p>
    </div>
  `;
  return { subject, html, text };
}
