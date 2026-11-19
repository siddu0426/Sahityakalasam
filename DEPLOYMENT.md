# 🚀 Kathalu (కథలు) Production Deployment & Operations Guide

This guide details the step-by-step procedures to deploy Kathalu to Vercel and Supabase production environments with zero security regressions.

---

## 1. Database Schema Synchronization

Before deploying the frontend or initiating production traffic, the PostgreSQL database must be synchronized with the authoritative migration.

1. Open your Supabase Project Dashboard -> **SQL Editor**.
2. Open `supabase/migrations/20261115000000_kathalu_full_schema.sql`.
3. Copy the entire file contents and paste into the SQL Editor.
4. Click **Run**.
5. Verify schema synchronization by executing:
   ```bash
   node scripts/verify-migration-drift.mjs
   ```
   **Acceptance Criteria**: The script outputs `🎉 ZERO DRIFT DETECTED!` with all 10 tables, views, and functions synchronized.

---

## 2. Production Environment Variables (Vercel)

Configure the following environment variables in the **Vercel Project Settings -> Environment Variables** (set to **Production**):

| Variable | Scope | Description | Sensitive |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Supabase project URL (`https://<project-ref>.supabase.co`) | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Supabase anonymous public API key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Only** | Supabase service role key (Never prefix with `NEXT_PUBLIC_`) | **CRITICAL** |
| `UPSTASH_REDIS_REST_URL` | **Server Only** | Upstash Redis REST endpoint (e.g. `https://<db>.upstash.io`) | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | **Server Only** | Upstash Redis REST bearer token | **CRITICAL** |
| `KV_REST_API_URL` | **Server Only** | (Optional alternative if using Vercel KV) | Yes |
| `KV_REST_API_TOKEN` | **Server Only** | (Optional alternative if using Vercel KV) | **CRITICAL** |
| `CRON_SECRET` | **Server Only** | High-entropy 32+ char secret for cron endpoint verification | **CRITICAL** |
| `RAZORPAY_KEY_ID` | Client & Server | Razorpay key ID (`rzp_live_...` or `rzp_test_...`) | No |
| `RAZORPAY_KEY_SECRET` | **Server Only** | Razorpay secret for HMAC-SHA256 signature verification | **CRITICAL** |
| `RAZORPAY_WEBHOOK_SECRET` | **Server Only** | Razorpay webhook secret for payment captures | **CRITICAL** |
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` | Client & Server | **MUST BE SET TO `false` IN PRODUCTION** | No |
| `NEXT_PUBLIC_ENABLE_PHONE_OTP` | Client & Server | Set to `false` (until Twilio SMS provider is enabled) | No |

> [!CAUTION]
> In production, the rate limiter **strictly fails closed** (returns HTTP 429 / blocks requests) if neither `UPSTASH_REDIS_REST_URL` nor `KV_REST_API_URL` is configured. This prevents distributed brute-force abuse across Vercel serverless instances.

---

## 3. Supabase Auth & Email OTP Configuration

The application uses real 6-digit numeric OTP verification for passwordless sign-ins and sign-ups.

### A. Template Configuration
Navigate to **Authentication -> Email Templates**:

1. **"Confirm signup"** (sent to brand-new email addresses):
   - **Subject**: `Your Kathalu verification code`
   - **Message Body**:
     ```html
     <h2>Namaskaram!</h2>
     <p>Your 6-digit verification code for Kathalu is:</p>
     <h1 style="letter-spacing: 4px; font-size: 32px; color: #1F7A6D;">{{ .Token }}</h1>
     <p>This code expires in 10 minutes. Please enter it in the app to complete sign-up.</p>
     <p>If you did not request this, please ignore this email.</p>
     ```

2. **"Magic Link"** (sent to returning listeners and narrators):
   - **Subject**: `Your Kathalu login code`
   - **Message Body**:
     ```html
     <h2>Namaskaram!</h2>
     <p>Your 6-digit login code for Kathalu is:</p>
     <h1 style="letter-spacing: 4px; font-size: 32px; color: #1F7A6D;">{{ .Token }}</h1>
     <p>This code expires in 10 minutes. Enter it into the app to log in.</p>
     ```

### B. OTP Expiration Time
Navigate to **Authentication -> URL Configuration** (or **Providers -> Email**):
- Find **Mailer OTP Expire (seconds)**.
- Set to `600` (10 minutes).
- Click **Save**.

---

## 4. Weekly Competition Cron Configuration

The automated competition tally runs every Sunday night at 23:59 IST (`18:29 UTC`).

- The schedule is declared in `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/weekly-tally",
        "schedule": "29 18 * * 0"
      }
    ]
  }
  ```
- **Execution Flow**:
  1. Vercel Cron triggers `GET /api/cron/weekly-tally` with `Authorization: Bearer <CRON_SECRET>`.
  2. The route invokes the database RPC `public.tally_weekly_winners()`.
  3. The active week's vote counts are tallied; the top story is shortlisted for Rank 1 (₹1,000 award); runner-ups are shortlisted for Rank 2 & 3 (₹0 award).
  4. Active week `stories.vote_count` resets to `0` for all stories for the newly begun week.
  5. In-app notification (`editorial_shortlist`) is delivered to all Admins.
  6. Admin navigates to `/admin` dashboard to review and confirm the shortlisted winner. Upon confirmation (`confirm_weekly_winner`), `stories.is_weekly_winner` is set to `true` and the winning narrator is notified.

---

## 5. Pre-Production Database Cleanup

To purge staging test data before production traffic begins:

1. **Dry-Run Inspection**:
   ```bash
   node scripts/cleanup-staging.mjs
   ```
   Inspect the output table of existing rows across tables and auth users.

2. **Destructive Execution**:
   ```bash
   node scripts/cleanup-staging.mjs --confirm
   ```
   Purges mock stories, votes, winners, notifications, and test auth accounts in foreign-key dependency order.

---

## 6. Secrets Rotation SOP

If any secret is ever flagged or rotated:

1. **`CRON_SECRET`**:
   - Generate a new 32-byte secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Update `CRON_SECRET` in Vercel Project Settings.
   - Trigger a production deployment or restart serverless functions.
2. **Supabase Service Role Key**:
   - Supabase Dashboard -> **Settings -> API -> JWT Secret -> Generate new secret / Rotate Service Role Key**.
   - Immediately update `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.
3. **Razorpay Key & Webhook Secret**:
   - Razorpay Dashboard -> **Settings -> API Keys / Webhooks**.
   - Regenerate key and update `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` in Vercel.

