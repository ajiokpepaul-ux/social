# ADUJI — short-video social starter

A Next.js + Supabase starter for a dark, neon-accented short-video social platform.

## Included in this starter

- Responsive desktop/mobile layout and a polished concept feed.
- Email/password sign-up and sign-in via Supabase Auth.
- Google OAuth button (requires provider setup in Supabase).
- Reads public video posts from Supabase.
- Uploads small test videos to Supabase Storage.
- Likes, comments, image comment attachments.
- GIF search UI using an optional GIPHY API key.
- Text message send by username.
- SQL schema, indexes, a profile-creation trigger, RLS policies, storage policies, and a basic feed-ranking SQL function.

## Important status notes

This is a **starter MVP**, not a finished production social network. Demo feed cards are illustrative and are not real posts. The current UI still has planned/incomplete actions (follow controls, profile editing, notifications, share links, saved collections, full conversation history, group chats, realtime chat subscriptions, and video response chains). The feed currently loads newest public videos; the SQL `get_recommended_videos` function is a baseline heuristic and is not yet wired into the frontend or a trained machine-learning model.

For real production video delivery, use a dedicated service that supports transcoding, adaptive streaming, moderation workflows, and signed playback URLs. Supabase Storage uploads in this starter are limited to small testing files.

## Requirements

- Node.js 20.9+ recommended
- A Supabase project
- Optional GIPHY API key for GIF search

## Run locally

1. Extract this ZIP.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Project Settings → API.
4. In Supabase Dashboard → SQL Editor, run `supabase/migrations/202610160001_aduji_schema.sql`.
5. In Supabase Authentication settings, configure allowed redirect URLs for your local URL and deployed domain.
6. For Google sign-in, enable Google under Authentication → Providers and configure OAuth credentials there.
7. Optional: add `NEXT_PUBLIC_GIPHY_API_KEY` to `.env.local`. Use a key that is permitted for browser use by your provider plan. Do not expose server secrets.
8. Install and start:

   ```bash
   npm install
   npm run dev
   ```

9. Open `http://localhost:3000`.

## Security checklist

- Only use Supabase's public anon/publishable key in browser env vars. Never expose `service_role` or secret keys.
- RLS is enabled on application tables. Review policies before production, particularly public media visibility and message/report flows.
- Configure Supabase Auth rate limits, email confirmation, password policy, and production redirect URLs.
- Add server-side validation, moderation, rate limiting, and abuse reporting before a public launch.
- The current client-side file checks are usability checks, not a security boundary. Enforce upload constraints at storage/server level too.
- Public Storage buckets make uploaded media readable by anyone with the URL. Do not put private media in public buckets.
- Before production, add tests, observability, backups, data retention rules, and privacy/terms pages.

## Recommendation baseline

The SQL function combines engagement counts and freshness. A serious ranking system should log watch duration, completion, skips, follows, hides, and explicit feedback; generate candidates from followed creators and related topics; diversify results; and evaluate retention and satisfaction. Don't optimize only for watch time or raw engagement.

## Suggested next steps

1. Wire the UI to `get_recommended_videos`.
2. Add follow/unfollow and event logging for watch time, completion, skip, share, and not-interested.
3. Add full inbox/conversation listing and Supabase Realtime subscriptions.
4. Add profile editing and media handling.
5. Integrate dedicated video processing and CDN delivery.
6. Add moderation/admin tooling and automated tests.
