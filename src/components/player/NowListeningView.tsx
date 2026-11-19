'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  Heart,
  Share2,
  Flag,
  CheckCircle,
  ShieldCheck,
  X,
  Volume2,
} from 'lucide-react';
import { useAudio } from '@/context/AudioContext';
import { useAuth } from '@/context/AuthContext';
import { formatDuration } from '@/lib/constants';
import { DataService } from '@/lib/data-service';
import { getPlaceholderCover } from '@/lib/illustrations';

export const NowListeningView: React.FC = () => {
  const {
    currentStory,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seek,
    skip,
    isNowListeningOpen,
    closeNowListening,
    voteCurrentStory,
  } = useAudio();

  const { currentUser, openLoginModal } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('audio_quality');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const [voteToast, setVoteToast] = useState<string>('');

  if (!isNowListeningOpen || !currentStory) {
    return null;
  }

  const handleVote = () => {
    if (!currentUser) {
      openLoginModal();
      return;
    }
    const result = voteCurrentStory();
    setVoteToast(result.message);
    setTimeout(() => setVoteToast(''), 3000);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${currentStory.title_telugu} on Kathalu`,
      text: `Listen to "${currentStory.title_telugu}" narrated by ${currentStory.narrator?.display_name} on Kathalu!`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Share cancelled or unsupported
      }
    } else {
      // WhatsApp fallback
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `${shareData.text} ${shareData.url}`
      )}`;
      window.open(waUrl, '_blank');
    }
    setIsMenuOpen(false);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    DataService.reportStory({
      storyId: currentStory.id,
      reporterId: currentUser?.id,
      reason: reportReason as any,
      details: reportDetails,
    });
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setIsReportModalOpen(false);
    }, 2000);
  };

  const effectiveDuration = duration > 0 ? duration : currentStory.duration_seconds || 180;
  const progressPercent = Math.min(100, (currentTime / (effectiveDuration || 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF8F5] flex flex-col items-center justify-start overflow-y-auto animate-in slide-in-from-bottom duration-300">
      <div className="w-full max-w-[430px] min-h-screen bg-[#FAF8F5] flex flex-col px-6 pt-5 pb-8 relative">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-3">
          <button
            onClick={closeNowListening}
            className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center text-[#1A2E2B] transition-colors tap-target"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <span className="text-[13px] font-bold uppercase tracking-wider text-[#7A8B86]">
            Now listening
          </span>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center text-[#1A2E2B] transition-colors tap-target"
              aria-label="Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-11 w-48 bg-white rounded-2xl shadow-float border border-[#EFEBE4] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={handleShare}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#1A2E2B] hover:bg-stone-50 flex items-center gap-2.5 font-medium"
                >
                  <Share2 className="w-4 h-4 text-teal-700" />
                  <span>Share story</span>
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 font-medium"
                >
                  <Flag className="w-4 h-4 text-rose-600" />
                  <span>Report content</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Large Rounded Cover */}
        <div className="w-full aspect-square mt-3 mb-6 rounded-3xl overflow-hidden shadow-cardHover border border-[#EAE5DC] bg-stone-100 relative group">
          <img
            src={currentStory.cover_url || getPlaceholderCover(currentStory.title_telugu, currentStory.genre)}
            alt={currentStory.title_telugu}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getPlaceholderCover(currentStory.title_telugu, currentStory.genre);
            }}
          />
          {isPlaying && (
            <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs flex items-center gap-1.5 font-medium">
              <Volume2 className="w-3.5 h-3.5 animate-pulse text-teal-300" />
              <span>Playing</span>
            </div>
          )}
        </div>

        {/* Titles & Genre */}
        <div className="text-center px-2">
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#1A2E2B] font-telugu leading-snug">
            {currentStory.title_telugu}
          </h1>
          <p className="text-[14px] text-[#627571] font-medium mt-1">
            {currentStory.title_english} · {currentStory.genre}
          </p>
        </div>

        {/* Narrator Row with Avatar */}
        <div className="mt-5 flex items-center justify-center gap-3 bg-white/80 border border-[#EAE5DC] rounded-2xl py-2 px-4 shadow-sm mx-auto max-w-[320px]">
          <img
            src={
              currentStory.narrator?.avatar_url ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentStory.narrator_id}`
            }
            alt={currentStory.narrator?.display_name}
            className="w-9 h-9 rounded-full object-cover border border-teal-200"
          />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#1A2E2B]">
                {currentStory.narrator?.display_name || 'కథకుడు'}
              </span>
              {currentStory.narrator?.is_minor && (
                <span title="Guardian Consent Verified">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7A8B86]">
              {currentStory.narrator?.show_age_city && currentStory.narrator?.age
                ? `Age ${currentStory.narrator.age}`
                : 'Narrator'}
              {currentStory.narrator?.show_age_city && currentStory.narrator?.city
                ? ` · ${currentStory.narrator.city}`
                : ''}
            </p>
          </div>
        </div>

        {/* Seekable Teal Progress Bar with Timers */}
        <div className="mt-7 w-full px-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={effectiveDuration}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-2 bg-[#E0EBE9] rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #1F7A6D ${progressPercent}%, #DDE8E5 ${progressPercent}%)`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs font-semibold text-[#7A8B86] mt-2">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Audio Playback Controls: Rewind 10s / Big Play-Pause / Forward 10s */}
        <div className="mt-6 flex items-center justify-center gap-8">
          {/* Rewind 10s */}
          <button
            onClick={() => skip(-10)}
            className="w-12 h-12 rounded-full hover:bg-stone-100 text-[#1A2E2B] flex flex-col items-center justify-center transition-all active:scale-95 tap-target"
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[10px] font-bold text-[#7A8B86] -mt-0.5">10</span>
          </button>

          {/* Big Play / Pause Button in Center */}
          <button
            onClick={togglePlay}
            className="w-18 h-18 w-16 h-16 rounded-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
            aria-label={isPlaying ? 'Pause story' : 'Play story'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={() => skip(10)}
            className="w-12 h-12 rounded-full hover:bg-stone-100 text-[#1A2E2B] flex flex-col items-center justify-center transition-all active:scale-95 tap-target"
            aria-label="Forward 10 seconds"
          >
            <RotateCw className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[10px] font-bold text-[#7A8B86] -mt-0.5">10</span>
          </button>
        </div>

        {/* Toast Notification */}
        {voteToast && (
          <div className="mt-4 p-2.5 bg-teal-800 text-white text-xs font-medium text-center rounded-xl animate-in fade-in">
            {voteToast}
          </div>
        )}

        {/* Full-Width "Vote for this story" Button with Heart */}
        <div className="mt-8 w-full">
          <button
            onClick={handleVote}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-md transition-all tap-target active:scale-[0.99] ${
              currentStory.user_has_voted
                ? 'bg-rose-50 border-2 border-rose-500 text-rose-700 hover:bg-rose-100'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <Heart
              className={`w-5 h-5 ${
                currentStory.user_has_voted ? 'fill-rose-500 text-rose-500' : 'fill-none'
              }`}
            />
            <span>
              {currentStory.user_has_voted
                ? `Voted! ❤️ (${currentStory.vote_count?.toLocaleString()} votes)`
                : `Vote for this story (${currentStory.vote_count?.toLocaleString()} votes)`}
            </span>
          </button>
          <p className="text-[11px] text-[#7A8B86] text-center mt-2">
            One vote per account per week. Weekly winner announced every Monday!
          </p>
        </div>
      </div>

      {/* Report Story Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-600" /> Report Content
              </h3>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-gray-800">Report Received</h4>
                <p className="text-xs text-gray-600">
                  Our safety team will review this recording against our guidelines. Thank you.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-stone-50"
                  >
                    <option value="audio_quality">Audio unclear or silent</option>
                    <option value="inappropriate_content">Inappropriate for children</option>
                    <option value="child_safety">Child safety concern</option>
                    <option value="copyright_music">Copyrighted music violation</option>
                    <option value="other">Other issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Details (optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm"
                >
                  Submit Report
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
