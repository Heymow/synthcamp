-- SynthCamp — "Starts in < 30 min" reminder for party alert subscribers.
-- A Next.js cron endpoint (/api/cron/party-reminders) scans this table
-- every few minutes and sends an in-app notification + email to each
-- party_alerts subscriber, then sets reminder_sent_at to prevent repeats.

ALTER TABLE public.listening_parties
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_parties_reminder_due
  ON public.listening_parties(scheduled_at)
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;

-- Add the reminder notification kind.
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'party_reminder';
