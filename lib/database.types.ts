// SynthCamp Phase 2 — Database types
//
// Mirrors the schema defined in supabase/migrations/*.sql.
// Generated manually (Supabase CLI `gen types` blocked on Supavisor/TLS).
//
// To regenerate after schema changes: update this file to match the migration SQL.
// Long-term: consider exposing supabase-db port directly + SSH tunnel for supabase gen types.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ===== Enums (shared) =====

export type CreditCategory = 'acoustic' | 'hybrid' | 'ai_crafted';
export type CreditVerificationStatus = 'declared' | 'pending_review' | 'verified';
export type ReleaseStatus = 'draft' | 'scheduled' | 'published' | 'unlisted' | 'archived';
export type PartyStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type RoomKind = 'global_master' | 'secondary';

// ===== Main Database type =====

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          slug: string | null;
          avatar_url: string | null;
          bio: string | null;
          is_artist: boolean;
          stripe_account_id: string | null;
          payout_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          slug?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_artist?: boolean;
          stripe_account_id?: string | null;
          payout_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          slug?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_artist?: boolean;
          stripe_account_id?: string | null;
          payout_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            isOneToOne: true;
          },
        ];
      };
      rooms: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: RoomKind;
          display_order: number;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          kind: RoomKind;
          display_order: number;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          kind?: RoomKind;
          display_order?: number;
        };
        Relationships: [];
      };
      releases: {
        Row: {
          id: string;
          artist_id: string;
          title: string;
          slug: string;
          description: string | null;
          cover_url: string;
          language: string | null;
          genres: string[];
          price_minimum: number;
          credit_category: CreditCategory;
          credit_tags: string[];
          credit_narrative: string | null;
          credits_per_track: boolean;
          verification_status: CreditVerificationStatus;
          release_date: string | null;
          status: ReleaseStatus;
          is_listed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          artist_id: string;
          title: string;
          slug: string;
          description?: string | null;
          cover_url: string;
          language?: string | null;
          genres?: string[];
          price_minimum?: number;
          credit_category: CreditCategory;
          credit_tags?: string[];
          credit_narrative?: string | null;
          credits_per_track?: boolean;
          verification_status?: CreditVerificationStatus;
          release_date?: string | null;
          status?: ReleaseStatus;
          is_listed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          artist_id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          cover_url?: string;
          language?: string | null;
          genres?: string[];
          price_minimum?: number;
          credit_category?: CreditCategory;
          credit_tags?: string[];
          credit_narrative?: string | null;
          credits_per_track?: boolean;
          verification_status?: CreditVerificationStatus;
          release_date?: string | null;
          status?: ReleaseStatus;
          is_listed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'releases_artist_id_fkey';
            columns: ['artist_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      tracks: {
        Row: {
          id: string;
          release_id: string;
          track_number: number;
          title: string;
          duration_seconds: number;
          audio_source_key: string | null;
          hls_manifest_key: string | null;
          aes_key_id: string | null;
          preview_url: string | null;
          plays_count: number;
          credit_category: CreditCategory | null;
          credit_tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          release_id: string;
          track_number: number;
          title: string;
          duration_seconds: number;
          audio_source_key?: string | null;
          hls_manifest_key?: string | null;
          aes_key_id?: string | null;
          preview_url?: string | null;
          plays_count?: number;
          credit_category?: CreditCategory | null;
          credit_tags?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          release_id?: string;
          track_number?: number;
          title?: string;
          duration_seconds?: number;
          audio_source_key?: string | null;
          hls_manifest_key?: string | null;
          aes_key_id?: string | null;
          preview_url?: string | null;
          plays_count?: number;
          credit_category?: CreditCategory | null;
          credit_tags?: string[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracks_release_id_fkey';
            columns: ['release_id'];
            referencedRelation: 'releases';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      listening_parties: {
        Row: {
          id: string;
          release_id: string;
          artist_id: string;
          room_id: string;
          scheduled_at: string;
          duration_seconds: number;
          ends_at: string;
          status: PartyStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          release_id: string;
          artist_id: string;
          room_id: string;
          scheduled_at: string;
          duration_seconds: number;
          ends_at?: string;
          status?: PartyStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          release_id?: string;
          artist_id?: string;
          room_id?: string;
          scheduled_at?: string;
          duration_seconds?: number;
          ends_at?: string;
          status?: PartyStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listening_parties_release_id_fkey';
            columns: ['release_id'];
            referencedRelation: 'releases';
            referencedColumns: ['id'];
            isOneToOne: true;
          },
          {
            foreignKeyName: 'listening_parties_artist_id_fkey';
            columns: ['artist_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'listening_parties_room_id_fkey';
            columns: ['room_id'];
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      party_moderators: {
        Row: {
          party_id: string;
          user_id: string;
          added_at: string;
          added_during_party: boolean;
        };
        Insert: {
          party_id: string;
          user_id: string;
          added_at?: string;
          added_during_party?: boolean;
        };
        Update: {
          party_id?: string;
          user_id?: string;
          added_at?: string;
          added_during_party?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'party_moderators_party_id_fkey';
            columns: ['party_id'];
            referencedRelation: 'listening_parties';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'party_moderators_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      purchases: {
        Row: {
          id: string;
          buyer_id: string;
          release_id: string;
          amount_paid: number;
          stripe_payment_intent: string | null;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          release_id: string;
          amount_paid: number;
          stripe_payment_intent?: string | null;
          purchased_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          release_id?: string;
          amount_paid?: number;
          stripe_payment_intent?: string | null;
          purchased_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_buyer_id_fkey';
            columns: ['buyer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'purchases_release_id_fkey';
            columns: ['release_id'];
            referencedRelation: 'releases';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          followed_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followed_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          followed_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'follows_followed_id_fkey';
            columns: ['followed_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_editors_choice: {
        Args: Record<PropertyKey, never>;
        Returns: {
          release_id: string;
          revenue_30d: number;
          is_fallback: boolean;
        }[];
      };
      validate_release_publish: {
        Args: { p_release_id: string };
        Returns: undefined;
      };
      validate_and_create_listening_party: {
        Args: {
          p_release_id: string;
          p_room_id: string;
          p_scheduled_at: string;
        };
        Returns: string;
      };
      cancel_listening_party: {
        Args: { p_party_id: string };
        Returns: undefined;
      };
      check_release_editable: {
        Args: { p_release_id: string };
        Returns: boolean;
      };
      compute_release_credits_from_tracks: {
        Args: { p_release_id: string };
        Returns: undefined;
      };
      cron_publish_future_releases: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      increment_track_play: {
        Args: { p_track_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      credit_category: CreditCategory;
      credit_verification_status: CreditVerificationStatus;
      release_status: ReleaseStatus;
      party_status: PartyStatus;
      room_kind: RoomKind;
    };
    CompositeTypes: Record<never, never>;
  };
}

// ===== Convenience type aliases =====

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Profile = Tables<'profiles'>;
export type Room = Tables<'rooms'>;
export type Release = Tables<'releases'>;
export type Track = Tables<'tracks'>;
export type ListeningParty = Tables<'listening_parties'>;
export type PartyModerator = Tables<'party_moderators'>;
export type Purchase = Tables<'purchases'>;
export type Follow = Tables<'follows'>;
