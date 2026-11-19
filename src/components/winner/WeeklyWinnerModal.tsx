'use client';

import React, { useEffect } from 'react';
import { Trophy, Share2, Award, Play, X, Heart, Sparkles, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '@/context/AudioContext';
import { DataService } from '@/lib/data-service';
import { getCurrentISTWeekRange, formatDuration } from '@/lib/constants';

interface WeeklyWinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyWinnerModal: React.FC<WeeklyWinnerModalProps> = ({ isOpen, onClose }) => {
  const { playStory } = useAudio();

  const storyOfTheWeek = DataService.getStoryOfTheWeek();
  const shortlist = DataService.getWeeklyShortlist();
  const weekRange = getCurrentISTWeekRange();

  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#1F7A6D', '#F59E0B', '#10B981', '#E11D48'],
        });
      } catch (e) {
        // ignore in non-browser or disabled canvas
      }
    }
  }, [isOpen]);

  if (!isOpen || !storyOfTheWeek) return null;

  const handleShareJoy = async () => {
    const text = `🎉 Celebrating "${storyOfTheWeek.title_telugu}" - Winner of Story of the Week on Kathalu with ${storyOfTheWeek.vote_count} votes and ₹1,000 reward! Listen here:`;
    const url = typeof window !== 'undefined' ? window.location.href : '';

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kathalu Story of the Week', text, url });
      } catch (e) {}
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`;
      window.open(waUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#FAF8F5] rounded-3xl p-5 shadow-2xl relative border border-amber-200 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Trophy & Date Range */}
        <div className="text-center pt-2 pb-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shadow-md mb-2">
            <Trophy className="w-8 h-8 text-amber-600 animate-bounce" />
          </div>
          <h2 className="text-xl font-black text-amber-900 tracking-tight">
            ఈ వారపు విజేత · Story of the Week
          </h2>
          <p className="text-xs font-semibold text-amber-800/80 mt-0.5">
            {weekRange.formattedRange}
          </p>
        </div>

        {/* Winner Card */}
        <div className="bg-white rounded-2xl p-4 shadow-card border-2 border-amber-200 relative overflow-hidden">
          <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-3 bg-stone-100">
            <img
              src={storyOfTheWeek.cover_url}
              alt={storyOfTheWeek.title_telugu}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 bg-amber-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> ₹1,000 Reward Winner
            </div>
          </div>

          <h3 className="text-lg font-bold text-[#1A2E2B] font-telugu">
            {storyOfTheWeek.title_telugu}
          </h3>
          <p className="text-xs text-[#627571] mt-0.5 font-medium">
            Narrated by {storyOfTheWeek.narrator?.display_name}
            {storyOfTheWeek.narrator?.show_age_city && storyOfTheWeek.narrator?.age
              ? `, age ${storyOfTheWeek.narrator.age}`
              : ''}{' '}
            · {formatDuration(storyOfTheWeek.duration_seconds)}
          </p>

          <div className="mt-3 p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>{storyOfTheWeek.vote_count?.toLocaleString()} Listener Votes</span>
            </div>
            <div className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
              ₹1,000 Awarded
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={() => {
                playStory(storyOfTheWeek);
                onClose();
              }}
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-transform tap-target"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Listen Now</span>
            </button>

            <button
              onClick={handleShareJoy}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-transform tap-target"
            >
              <Share2 className="w-4 h-4" />
              <span>Share this joy</span>
            </button>
          </div>
        </div>

        {/* Shortlist of Top 5 */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[#1A2E2B] uppercase tracking-wider">
              Top 5 Shortlist this Week
            </h4>
            <span className="text-[11px] text-[#7A8B86]">Tally every Sun 23:59 IST</span>
          </div>

          <div className="space-y-2">
            {shortlist.map((story, idx) => (
              <div
                key={story.id}
                onClick={() => {
                  playStory(story);
                  onClose();
                }}
                className="bg-white p-2.5 rounded-xl border border-[#EFEBE4] flex items-center gap-2.5 cursor-pointer hover:bg-stone-50 transition-colors"
              >
                <span className="w-5 font-bold text-xs text-teal-800 text-center">
                  #{idx + 1}
                </span>
                <img
                  src={story.cover_url}
                  alt={story.title_telugu}
                  className="w-9 h-9 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1A2E2B] font-telugu truncate">
                    {story.title_telugu}
                  </p>
                  <p className="text-[10px] text-[#7A8B86] truncate">
                    {story.narrator?.display_name} · {story.vote_count} votes
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
