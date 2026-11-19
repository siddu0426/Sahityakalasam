'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Play,
  Trophy,
  CreditCard,
  Flag,
  ArrowLeft,
  Volume2,
  Check,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { REJECT_PRESET_REASONS, formatDuration, getCurrentISTWeekRange } from '@/lib/constants';
import { Story, StoryReport } from '@/lib/types';

export default function AdminDashboardPage() {
  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'review' | 'shortlist' | 'payments' | 'reports'>('review');
  const [rejectModalStory, setRejectModalStory] = useState<Story | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(REJECT_PRESET_REASONS[0].label);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');
  const [isTallyRunning, setIsTallyRunning] = useState<boolean>(false);

  const [pendingStories, setPendingStories] = useState<Story[]>([]);
  const [shortlist, setShortlist] = useState<Story[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reports, setReports] = useState<StoryReport[]>([]);

  const weekRange = getCurrentISTWeekRange();

  const refreshData = () => {
    setPendingStories(DataService.getStories({ status: 'pending' }));
    setShortlist(DataService.getWeeklyShortlist());
    setPayments(DataService.getPayments());
    setReports(DataService.getReports());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleApprove = (storyId: string) => {
    DataService.approveStory(storyId, currentUser?.id || 'usr-admin-01');
    refreshData();
    showToast('Story approved and published to live catalog!');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalStory) return;

    DataService.rejectStory(
      rejectModalStory.id,
      selectedReason,
      customNotes,
      currentUser?.id || 'usr-admin-01'
    );

    setRejectModalStory(null);
    setCustomNotes('');
    refreshData();
    showToast('Story marked as rejected with feedback for free resubmission.');
  };

  const handleConfirmWinner = (storyId: string) => {
    DataService.confirmWeeklyWinner(storyId);
    refreshData();
    showToast('Weekly winner confirmed and announced! ₹1,000 reward granted.');
  };

  const handleRunTallyNow = async () => {
    setIsTallyRunning(true);
    try {
      const res = await fetch('/api/cron/weekly-tally', { method: 'POST' });
      const data = await res.json();
      refreshData();
      showToast(data.message || 'Weekly tally executed successfully!');
    } catch (e: any) {
      showToast(`Tally executed: ${e.message}`);
    } finally {
      setIsTallyRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#1A2E2B]">
      {/* Top Header */}
      <header className="bg-[#134F47] text-white px-6 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors tap-target"
              title="Return to App"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-300" />
                <h1 className="text-xl font-bold tracking-tight">Kathalu Editorial Desk</h1>
              </div>
              <p className="text-xs text-teal-200">
                Story review, weekly shortlist confirmation, payments, and child safety moderation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-white/10 px-3 py-1.5 rounded-full text-teal-100 font-medium">
              Signed in as <b>{currentUser?.display_name}</b> ({currentUser?.role || 'admin'})
            </span>
            <button
              onClick={refreshData}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Toast Alert */}
        {actionMessage && (
          <div className="mb-6 p-4 bg-emerald-800 text-white font-medium rounded-2xl shadow-md flex items-center justify-between animate-in fade-in">
            <span>{actionMessage}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          </div>
        )}

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#D8D2C5] pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all tap-target ${
              activeTab === 'review'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#EAE5DC]'
            }`}
          >
            <span>Review Queue</span>
            {pendingStories.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-400 text-amber-950 font-black">
                {pendingStories.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('shortlist')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all tap-target ${
              activeTab === 'shortlist'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#EAE5DC]'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Weekly Shortlist (Top 5)</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all tap-target ${
              activeTab === 'payments'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#EAE5DC]'
            }`}
          >
            <CreditCard className="w-4 h-4 text-teal-600" />
            <span>Payments & Credits</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all tap-target ${
              activeTab === 'reports'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#EAE5DC]'
            }`}
          >
            <Flag className="w-4 h-4 text-rose-500" />
            <span>Moderation Reports</span>
            {reports.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-black">
                {reports.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: REVIEW QUEUE */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Pending Review Submissions</h2>
                <p className="text-xs text-[#7A8B86]">
                  Listen to submitted Telugu audio narrations and verify suitability before approving
                </p>
              </div>
              <span className="text-xs font-semibold bg-white px-3 py-1.5 rounded-xl border border-[#EAE5DC]">
                {pendingStories.length} stories waiting
              </span>
            </div>

            {pendingStories.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-[#EFEBE4] shadow-card">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h3 className="font-bold text-lg">All caught up!</h3>
                <p className="text-sm text-stone-500">
                  There are no pending stories in the review queue.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingStories.map((story) => (
                  <div
                    key={story.id}
                    className="bg-white rounded-3xl p-5 shadow-card border border-[#EFEBE4] space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3.5 mb-3">
                        <img
                          src={story.cover_url}
                          alt={story.title_telugu}
                          className="w-16 h-16 rounded-2xl object-cover bg-stone-100"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-teal-800 bg-[#E5F2F0] px-2 py-0.5 rounded-md">
                            {story.genre}
                          </span>
                          <h3 className="text-lg font-bold text-[#1A2E2B] font-telugu mt-1 truncate">
                            {story.title_telugu}
                          </h3>
                          <p className="text-xs text-[#627571] truncate">{story.title_english}</p>
                        </div>
                      </div>

                      {/* Narrator Info & Child Safety Check */}
                      <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#EAE5DC] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1A2E2B]">
                            Narrator: {story.narrator?.display_name || 'కథకుడు'}
                          </span>
                          {story.narrator?.is_minor ? (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Guardian
                              Consent
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-500">Adult</span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500">
                          Age: {story.narrator?.age || 'Unspecified'} · City:{' '}
                          {story.narrator?.city || 'Unspecified'}
                        </p>
                      </div>

                      {/* Audio Player in Dashboard */}
                      <div className="mt-4 p-3 bg-teal-50/60 rounded-2xl border border-teal-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                          <span className="flex items-center gap-1.5">
                            <Volume2 className="w-4 h-4 text-teal-700" /> Recorded Audio
                          </span>
                          <span>{formatDuration(story.duration_seconds)}</span>
                        </div>
                        <audio
                          controls
                          src={story.audio_url}
                          className="w-full h-9 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Action Buttons: Approve / Reject */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleApprove(story.id)}
                        className="flex-1 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors tap-target"
                      >
                        <Check className="w-4 h-4" /> Approve Story
                      </button>

                      <button
                        onClick={() => {
                          setRejectModalStory(story);
                          setCustomNotes('');
                        }}
                        className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-colors tap-target"
                      >
                        <XCircle className="w-4 h-4" /> Reject with Reasons
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEEKLY SHORTLIST & WINNER */}
        {activeTab === 'shortlist' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Top 5 Weekly Shortlist</h2>
                <p className="text-xs text-[#7A8B86]">
                  Current week: {weekRange.formattedRange} · Scheduled tally runs Sunday 23:59 IST
                </p>
              </div>

              {/* Admin "Run Now" Button for Instant Testing */}
              <button
                onClick={handleRunTallyNow}
                disabled={isTallyRunning}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-transform active:scale-95 disabled:opacity-50 tap-target"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isTallyRunning ? 'Running Tally...' : 'Run Tally Now (Testing Shortcut)'}</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-card border border-[#EFEBE4] space-y-4">
              {shortlist.map((story, idx) => (
                <div
                  key={story.id}
                  className="p-4 rounded-2xl border border-[#EAE5DC] flex flex-wrap items-center justify-between gap-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-black flex items-center justify-center text-sm">
                      #{idx + 1}
                    </span>
                    <img
                      src={story.cover_url}
                      alt={story.title_telugu}
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="font-bold text-[#1A2E2B] font-telugu text-base">
                        {story.title_telugu}
                      </h3>
                      <p className="text-xs text-[#627571]">
                        By {story.narrator?.display_name} · {story.genre} ·{' '}
                        {formatDuration(story.duration_seconds)}
                      </p>
                      <span className="text-xs font-bold text-teal-800">
                        {story.vote_count?.toLocaleString()} votes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {story.is_weekly_winner ? (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 border border-amber-300">
                        <Trophy className="w-4 h-4 text-amber-600" /> Current Confirmed Winner
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirmWinner(story.id)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors tap-target"
                      >
                        <Trophy className="w-3.5 h-3.5" /> Confirm Winner (₹1,000)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENTS LIST */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Payments & Upload Credits</h2>
              <p className="text-xs text-[#7A8B86]">
                ₹20 entry fees paid by narrators via Razorpay
              </p>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden shadow-card border border-[#EFEBE4]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] border-b border-[#EFEBE4] text-[#7A8B86] uppercase font-bold">
                  <tr>
                    <th className="p-4">Payment ID</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE4]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-stone-500">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="p-4 font-mono text-[11px]">{p.razorpay_payment_id || p.id}</td>
                        <td className="p-4 font-semibold">{p.user_id}</td>
                        <td className="p-4 font-bold text-teal-800">₹{(p.amount / 100).toFixed(2)}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4 text-stone-500">
                          {new Date(p.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS MODERATION */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Moderation & Safety Reports</h2>
              <p className="text-xs text-[#7A8B86]">
                Community reports submitted on stories
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-card border border-[#EFEBE4]">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-stone-500 text-sm">
                  No pending moderation reports.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-rose-600" />
                          <span className="font-bold text-xs text-rose-900 uppercase">
                            {r.reason.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-stone-800 mt-1">
                          Story: {r.story_title || r.story_id}
                        </p>
                        {r.details && (
                          <p className="text-xs text-stone-600 mt-0.5">{r.details}</p>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REJECT WITH PRESET REASONS MODAL */}
      {rejectModalStory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-lg text-gray-900 font-telugu">
              కథ తిరస్కరణ వివరాలు (Reject Feedback)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Select reason and provide guidance. The narrator will be allowed to re-record for free!
            </p>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Preset Reason
                </label>
                <div className="space-y-2">
                  {REJECT_PRESET_REASONS.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                        selectedReason === reason.label
                          ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                          : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        checked={selectedReason === reason.label}
                        onChange={() => setSelectedReason(reason.label)}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div>{reason.label}</div>
                        <p className="text-[11px] text-stone-500 font-normal">
                          {reason.explanation}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Custom Notes to Narrator (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Try speaking closer to the mic..."
                  className="w-full p-2.5 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalStory(null)}
                  className="flex-1 py-3 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-50 tap-target"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm tap-target"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
