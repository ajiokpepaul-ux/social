# ADUJI — HTML/CSS/JavaScript full-stack starter

A browser-first social video website starter. No npm or local build step is required for the frontend: it uses plain HTML, CSS and JavaScript, with Supabase JS loaded from a CDN.

## What's included

- Responsive dark ADUJI UI
- Feed, search, hashtag topics, latest/recommended tabs
- Sign-up/sign-in with email and password
- Google OAuth button (requires Supabase + Google OAuth configuration)
- Public creator profiles and profile editing
- Create posts with image/video uploads
- Likes, comments, follows and saved posts
- Basic direct-message thread creation and sending
- Supabase SQL schema with row-level security policies
- Public `post-media` storage bucket with owner-folder upload policies
- Preview mode with sample creators/posts before backend setup

## Important status

This is a complete starter foundation, not a production-audited social network. The direct-message screen currently supports starting/sending a conversation; a full conversation list/live chat UI, moderation tools, reporting/blocking, notifications, rate limiting, transcoding, recommendation ranking, admin tooling and production security review still need implementation before a public launch. Demo mode is local only; it does not share data across users.

## Run locally with no npm

1. Extract the ZIP.
2. Open `index.html` in Chrome.
3. The sample feed and front-end interactions work in preview mode.

For a public URL without paying, push these files to a GitHub repository and import the repo into a compatible static hosting service's free tier. Free-plan eligibility and commercial-use restrictions depend on the provider.

## Connect a real Supabase backend

1. Create a project at https://supabase.com.
2. In the Supabase dashboard, open **SQL Editor → New query**.
3. Copy all of `supabase/schema.sql` into the editor and run it.
4. Open **Project Settings → API** (or **Connect**) and copy:
   - Project URL
   - Publishable/anon public key
5. Open `app.js` and set:
   ```js
   const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";
   ```
   The browser key must be the publishable/anon key. **Never use a service_role/secret key in browser JavaScript.**
6. Redeploy the updated files. Reload the site.
7. Sign up with an email and password. Depending on your Supabase Auth settings, email confirmation may be required.

### Google sign-in

1. Supabase Dashboard → Authentication → Providers → Google.
2. Follow Supabase's current Google provider instructions to create OAuth credentials in Google Cloud.
3. Add the Google Client ID/Secret in Supabase.
4. Configure the authorized redirect URLs in Google Cloud and Supabase Auth URL Configuration for your deployed site.
5. Google sign-in only appears after the app has a configured Supabase connection.

## Deploy with GitHub and Vercel

1. Create a GitHub repository and upload `index.html`, `styles.css`, `app.js`, and the `supabase` folder.
2. Import the repository into Vercel.
3. Because this is plain static HTML, set **Framework Preset: Other**, leave the **Build Command** empty, and leave **Output Directory** empty (or use `.` only if the dashboard requires an output directory). Root Directory should be the folder containing `index.html`.
4. Deploy. Ensure the project root contains `index.html`.
5. Open the assigned deployment URL, then connect the Supabase keys as described above.

## Backend tables

- `profiles`
- `posts`
- `likes`
- `comments`
- `follows`
- `saved_posts`
- `conversations`
- `conversation_participants`
- `messages`

RLS is enabled. Review the policies and add moderation/report/blocking, stronger conversation participant rules, rate limits, and storage abuse protection before production use.

## Free-tier reality

Supabase and hosting providers have quotas and plan terms. Free storage is limited; public video hosting at scale is not unlimited and can become expensive. Keep test videos small and review current plan limits. The site is not live-connected until you create the Supabase project, run the SQL, add your URL/key, and deploy.
