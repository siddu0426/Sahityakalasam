# 📋 Kathalu (కథలు) · Multi-User Staging Tester Guide

Welcome to testing the **Kathalu** Telugu audio story platform! Use this 1-page checklist to verify that multi-user audio recording, review workflows, real-time voting, and weekly winner celebration work smoothly across desktop and mobile devices.

---

## 🚀 Quick Setup & Access
- **Local / Staging URL**: `http://localhost:3000` (or your deployed Vercel URL)
- **Admin Review Desk**: `http://localhost:3000/admin`
- **Developer Console**: `http://localhost:3000/dev` (Switch test roles instantly)
- **Health & Metrics Endpoint**: `http://localhost:3000/api/health`

---

## 👥 Pre-Configured Test Accounts (OTP is `123456` in Test Mode)

| Role | Name | Phone / Identifier | Email | Default State |
| :--- | :--- | :--- | :--- | :--- |
| **Admin 1** | Editor Varma | `+91 98888 00001` | `admin1@kathalu.app` | Can approve/reject stories, trigger weekly winner |
| **Admin 2** | Desk Lakshmi | `+91 98888 00002` | `admin2@kathalu.app` | Secondary editorial desk access |
| **Narrator 1** | Saanvi (Age 12) | `+91 97777 00001` | `saanvi@kathalu.app` | Story of the Week narrator (Guardian verified) |
| **Narrator 2** | Ramana Thatha (Age 68) | `+91 97777 00002` | `ramana@kathalu.app` | Traditional folk storyteller |
| **Narrator 3** | Ananya (Age 14) | `+91 97777 00003` | `ananya@kathalu.app` | Panchatantra tales narrator |
| **Listener 1** | Ravi | `+91 96666 00001` | `ravi@kathalu.app` | Regular voter & listener |
| **Listener 2** | Priya | `+91 96666 00002` | `priya@kathalu.app` | Regular voter & listener |

*Note: Any custom Indian phone number (+91 9XXXX XXXXX) or email can be entered; OTP `123456` verifies instantly in staging mode.*

---

## 🧪 5-Step Multi-User Test Checklist

### 1. Narrator Submits Story (Phone A / Tab 1)
- [ ] Open Home tab and click **Upload** ("Tell your story").
- [ ] Step 1 (Payment): In staging/dev mode, an upload credit is pre-granted or click "Simulate Razorpay Test Pay ₹20".
- [ ] Step 2 (Record): Tap the big teal microphone. Speak in Telugu for 5-10 seconds. Waveform animates in real time.
- [ ] Tap stop, tap "Play preview" to hear your recording. (Or tap "Upload a file instead" if testing without microphone).
- [ ] Step 3 (Details): Enter a Telugu title (e.g. `చందమామ కథలు`) and choose genre (`Folk Tales`).
- [ ] Tap **Submit story**.
- [ ] Status updates to `"Pending Admin Review"`. Bottom navigation bar does not overlap the button!

### 2. Admin Reviews & Approves (Desktop / Tab 2)
- [ ] Navigate to `/admin`.
- [ ] Under **Pending Review Queue**, locate the newly submitted story.
- [ ] Click play to preview narrator's audio track.
- [ ] Click **Approve**. Story immediately moves from Pending to Live.
- [ ] *(Optional test: Click Reject on another submission, pick reason "Audio unclear · Low volume", and verify narrator gets free re-record without paying ₹20 again).*

### 3. Concurrent Voting by Listeners (Phone B & Phone C / Tab 3 & 4)
- [ ] Sign in as **Listener 1 (Ravi)** in one window and **Listener 2 (Priya)** in another.
- [ ] Open the newly approved story on both devices.
- [ ] In Listener 1's window, tap **"Vote for this story"**. Vote counter increments by +1 immediately.
- [ ] In Listener 2's window, tap **"Vote for this story"**. Vote counter increments by +1 immediately.
- [ ] In Listener 1's window, tap the vote button again. Confirm it toggles off and decrements by -1 (1 vote per user per story rule). Tap once more to re-cast vote.

### 4. Audio Playback & Mini-Player Clearance
- [ ] Tap play on any story row or the Story of the Week card.
- [ ] Verify audio streams smoothly and seek bar advances.
- [ ] Navigate between Home, Listen, and Profile tabs.
- [ ] Notice the **Mini Player** sits neatly above the bottom navigation bar.
- [ ] Verify no list item or button is obscured by the mini player (`page-bottom-padding-with-mini` dynamic spacing).
- [ ] Tap the "X" button on the mini player to dismiss it.

### 5. Weekly Winner Tally & Celebration
- [ ] As Admin in `/admin`, scroll to **Weekly Shortlist (Top 5)**.
- [ ] Click **"Run Tally Now (Test)"** or **"Confirm Winner"**.
- [ ] In any listener or narrator window, tap the round waveform button at top right of Home, or open the notification.
- [ ] The **Weekly Winner Screen** opens with celebratory confetti animation (`canvas-confetti`), ₹1,000 prize announcement, and WhatsApp share button.

---

## 🐛 Bug Reporting Template

If you encounter any unexpected behavior, copy this template and share it:

```markdown
**Device & Browser**: (e.g. iPhone 15 Safari / Android Pixel 7 Chrome / Windows Edge)
**Screen Dimensions**: (e.g. 390x844)
**User Account**: (e.g. Saanvi / Listener 1 / Guest)
**Steps to Reproduce**:
1. 
2. 
3. 
**Observed Result**: 
**Expected Result**: 
**Console / Network Logs** (if available):
```

