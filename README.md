# Kathalu (à°•à°¥à°²à±) Â· Complete Telugu Audio Storytelling Platform

A warm, community-driven web application dedicated to authentic Telugu audio stories told by children and elders. Built with Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL with RLS), Razorpay (â‚¹20 entry fee test mode), and Progressive Web App (PWA) support.

---

## ðŸ“± Visual & Responsive Design (Part A)

- **Phone-Ratio Column**: Centered with `max-width: 430px`, set against a soft neutral backdrop on wider screens (`#E8E5DF`).
- **Color Palette**:
  - Primary Brand Teal: `#1F7A6D` (Deep Teal)
  - Light Teal Tint: `#E5F2F0` / `#E8F3F1` for chips, stats, and badges
  - Warm Off-White: `#FAF8F5`
  - High Contrast Dark Slate: `#1A2E2B`
  - Card Border: `#EFEBE4`
- **Typography**:
  - Latin/English: `Inter`
  - Telugu: `Noto Sans Telugu` with fluid line-height (`â‰¥ 1.5 - 1.6`) to prevent text clipping
- **Pixel-Matched Design Elements**:
  - **Genre Chips**: Pill-shaped (`height: 44px`, horizontal padding `20px`, `white-space: nowrap`, `flex: none`, `gap: 8-10px`, hidden scrollbar). Selected = filled teal with white text; unselected = white with thin border `#EAE5DC`. No stray underline bar or clipped text.
  - **Dynamic Clearance**: Dynamic bottom clearance for scrollable pages (`calc(9.5rem + env(safe-area-inset-bottom))` when the floating mini player is visible) so buttons like **"Submit story"** on Upload and story rows on Home are never hidden behind the nav or player.
  - **Illustrated Story Covers**: 16:9 warm painted folklore covers for Story of the Week, square thumbnails for story rows, and SVG inline fallback generator (`getPlaceholderCover`).
  - **Clean Header**: "Namaskaram, {name}", "A story for today.", and round waveform icon at top right triggering Weekly Winner modal.
  - **Upload Tab Badge**: Shows badge ("1") only when a narrator has an actual pending or rejected revision item.
  - **Testing Tools**: Isolated to `/dev` route gated by `NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'`.

---

## ðŸ—ï¸ Real Multi-User Backend Architecture (Part B)

The application provides a unified backend supporting both live Supabase PostgreSQL and a high-performance in-process synchronized store for simultaneous multi-user testing:

1. **Multi-User Concurrency & Roles**:
   - Roles: `listener`, `narrator`, `admin`.
   - Seeded test accounts: 2 Admins, 5 Narrators (with guardian flags for minors), 10 Listeners.
   - Admin access to `/admin` protected server-side with role checks.
   - Test account creation script: `node scripts/create-user.mjs --role narrator --name "Storyteller"`.

2. **Row Level Security (RLS)**:
   - Full migration in `supabase/migrations/20261115000000_kathalu_full_schema.sql`.
   - Tables: `profiles`, `stories`, `payments`, `upload_credits`, `votes`, `weekly_winners`, `story_reports`, `notifications`.
   - Policies: Public can only view `live` stories; narrators read/edit only their own; only admins approve, reject, and confirm weekly winners.

3. **Storage & Media Handling**:
   - `story-audio` bucket: 25MB max file size, audio MIME enforcement (`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`).
   - `story-covers` bucket: 5MB max file size, image MIME enforcement.
   - Server-side validation via `/api/storage/upload`.

4. **Razorpay Payments (â‚¹20 Entry Fee)**:
   - Order creation via `/api/razorpay/create-order`.
   - Verified HMAC SHA256 signature webhook at `/api/razorpay/webhook`.
   - Idempotency: Duplicate payment events never double-credit.
   - Failed upload keeps the credit for next submission.

5. **Upload & Free Resubmission**:
   - In-browser recording with `MediaRecorder` + live waveform + timer + preview.
   - File upload fallback for iOS Safari and pre-recorded audio.
   - Consumes 1 credit per submission; rejected stories can be resubmitted for free without paying â‚¹20 again.

6. **Weekly Winner & Tally**:
   - Strict 1 vote per account per story per IST week (Asia/Kolkata).
   - Sunday 23:59 IST tally cron job via `/api/cron/weekly-tally` (secured by `CRON_SECRET`).
   - Admin "Run Tally Now" test button on `/admin`.
   - Celebratory winner screen with confetti (`canvas-confetti`) and WhatsApp sharing.

7. **Observability & Health**:
   - `/api/health` reports status, database connectivity, user count, live/pending/rejected story counts, and IST timestamp.

---

## ðŸ§ª Automated Test Suites

### 1. Vitest Unit & Integration Tests (15 tests)
```bash
npm test
```
Verifies:
- **Payment Webhook**: HMAC SHA256 signature verification, idempotency, and duplicate protection.
- **Vote Uniqueness**: Concurrency safety, 1 vote per account per story per week, instant toggling.
- **RLS & Child Safety**: Public visibility filters, narrator draft boundaries, minor guardian verification, phone number privacy.

### 2. Playwright Multi-User Concurrency & Viewport Tests (5 tests)
```bash
npx playwright test
```
Verifies:
- **Multi-User Concurrency**: 4 simultaneous browser contexts:
  1. Narrator submits story.
  2. Admin reviews and approves story on `/admin`.
  3. Listener 1 casts vote.
  4. Listener 2 casts vote concurrently.
  5. Verifies both votes are recorded accurately and state is consistent across all users.
- **Responsive Viewports**:
  - `360x640` (Compact Mobile)
  - `390x844` (iPhone Standard)
  - `430x932` (Flagship Mobile)
  - `1280x800` (Desktop Centered Column)
  - Confirms zero horizontal overflow, 44px genre pill chips, and clear bottom navigation spacing.

---

## ðŸš€ Local Run Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Out of the box, safe defaults allow testing immediately without external credentials!)*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 4. Build and Start Production Server
```bash
npm run build
npm start
```

---

## ðŸŒ Staging Deployment Guide (Vercel + Supabase)

### Step 1: Deploy to Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, run `supabase/migrations/20261115000000_kathalu_full_schema.sql`.
3. In Storage, ensure `story-audio` and `story-covers` buckets are created.

### Step 2: Deploy to Vercel
1. Push this repository to GitHub or GitLab.
2. In Vercel, click **Import Project** and select the repository.
3. Configure the Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL (`https://xyz.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`: `rzp_test_...`
   - `RAZORPAY_KEY_SECRET`: Razorpay test secret
   - `RAZORPAY_WEBHOOK_SECRET`: Your webhook secret
   - `CRON_SECRET`: Random 32+ character string
   - `NEXT_PUBLIC_ENABLE_DEV_TOOLS`: Set to `true` on staging, `false` on production
4. Deploy.

### Step 3: Razorpay Webhook Configuration
1. Open Razorpay Dashboard â†’ Settings â†’ Webhooks.
2. Add Webhook URL: `https://<your-vercel-domain>.vercel.app/api/razorpay/webhook`.
3. Select events: `order.paid`, `payment.captured`.
4. Enter the same `RAZORPAY_WEBHOOK_SECRET` configured in Vercel.

### Step 4: Scheduled Cron Setup
To run the weekly tally automatically every Sunday 23:59 IST:
In `vercel.json` or your cron scheduler:
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
*(18:29 UTC = 23:59 IST every Sunday).*

---

## âš ï¸ Known Limitations

1. **In-Browser Audio Recording on Older iOS Safari**: Some older iOS webviews restrict the Web Audio API or `MediaRecorder` without prior user tap. The app includes a prominent **"Upload a file instead"** fallback button for complete compatibility.
2. **Razorpay Test Mode**: In test mode, actual credit cards / UPI are not debited. Use test UPI ID `success@razorpay` or test cards.
3. **SMS OTP Gateway**: When `ENABLE_REAL_SMS=false`, any 6-digit OTP will be validated with `123456` in testing mode so beta testers do not consume SMS credits.
#   S a h i t y a k a l a s a m  
 


---

## 🗳️ Voting Model & Weekly Competition Lifecycle

Kathalu employs an authentic **Weekly Community Voting Model** designed for fair creator discovery:

1. **Weekly Cycle Window**:
   - Each competition week runs from **Monday 00:00:00 IST to Sunday 23:59:59 IST** (`Asia/Kolkata` timezone).
   - Server-computed week boundary: `v_week_start := (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata'))::DATE;`.

2. **One Vote Per User Per Story Per Week**:
   - Authenticated listeners can cast exactly **one vote per story per week** (`UNIQUE(story_id, user_id, week_start)`).
   - Listeners can toggle their vote on and off during the active week.
   - Advisory transaction locking (`pg_advisory_xact_lock`) serializes concurrent toggles per user and per story, preventing race conditions.

3. **Current Active Week vs All-Time Metrics**:
   - **`stories.vote_count`**: Represents the **active competition week votes**. This powers:
     - Home tab "🔥 Most Voted" sorting and trending list
     - Real-time "Story of the Week" contender ranking
     - Weekly shortlist for editorial review
   - **`weekly_winners` Archive**: At the close of each week, the `tally_weekly_winners` job snapshots the winner, sets `stories.is_weekly_winner = true`, and archives the winning vote tally permanently.
   - **Profile All-Time Metrics**: Narrator profiles display their full published story catalog and aggregate listener engagement.
