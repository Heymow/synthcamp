-- SynthCamp Phase 2 Migration 1 — Extensions and ENUMs
-- Per spec § 6 (docs/superpowers/specs/2026-04-22-phase2-identity-catalog-design.md)

-- Extensions required
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- EXCLUDE gist constraints on time ranges
CREATE EXTENSION IF NOT EXISTS pg_cron;        -- scheduled SQL jobs

-- Enums
CREATE TYPE credit_category AS ENUM ('acoustic', 'hybrid', 'ai_crafted');
CREATE TYPE credit_verification_status AS ENUM ('declared', 'pending_review', 'verified');
CREATE TYPE release_status AS ENUM ('draft', 'scheduled', 'published', 'unlisted', 'archived');
CREATE TYPE party_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE room_kind AS ENUM ('global_master', 'secondary');
