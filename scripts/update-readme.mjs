import fs from 'fs';

let content = fs.readFileSync('README.md', 'utf8');
const section = `

---

## 🗳️ Voting Model & Weekly Competition Lifecycle

Kathalu employs an authentic **Weekly Community Voting Model** designed for fair creator discovery:

1. **Weekly Cycle Window**:
   - Each competition week runs from **Monday 00:00:00 IST to Sunday 23:59:59 IST** (\`Asia/Kolkata\` timezone).
   - Server-computed week boundary: \`v_week_start := (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata'))::DATE;\`.

2. **One Vote Per User Per Story Per Week**:
   - Authenticated listeners can cast exactly **one vote per story per week** (\`UNIQUE(story_id, user_id, week_start)\`).
   - Listeners can toggle their vote on and off during the active week.
   - Advisory transaction locking (\`pg_advisory_xact_lock\`) serializes concurrent toggles per user and per story, preventing race conditions.

3. **Current Active Week vs All-Time Metrics**:
   - **\`stories.vote_count\`**: Represents the **active competition week votes**. This powers:
     - Home tab "🔥 Most Voted" sorting and trending list
     - Real-time "Story of the Week" contender ranking
     - Weekly shortlist for editorial review
   - **\`weekly_winners\` Archive**: At the close of each week, the \`tally_weekly_winners\` job snapshots the winner, sets \`stories.is_weekly_winner = true\`, and archives the winning vote tally permanently.
   - **Profile All-Time Metrics**: Narrator profiles display their full published story catalog and aggregate listener engagement.
`;

if (!content.includes('Voting Model & Weekly Competition Lifecycle')) {
  content += section;
  fs.writeFileSync('README.md', content, 'utf8');
  console.log('Appended voting model documentation to README.md');
}

