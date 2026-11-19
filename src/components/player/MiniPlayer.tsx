'use client';

import React from 'react';
import { Play, Pause, X } from 'lucide-react';
import { useAudio } from '@/context/AudioContext';
import { getPlaceholderCover } from '@/lib/illustrations';

export const MiniPlayer: React.FC = () => {
  const {
    currentStory,
    isPlaying,
    togglePlay,
    openNowListening,
    isMiniPlayerActive,
    dismissMiniPlayer,
  } = useAudio();

  if (!isMiniPlayerActive || !currentStory) {
    return null;
  }

  return (
    <div
      className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[406px] z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-cardHover border border-teal-100/80 p-2.5 flex items-center gap-3 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
      onClick={openNowListening}
      role="region"
      aria-label="Now playing bar"
    >
      {/* Cover image */}
      <img
        src={currentStory.cover_url || getPlaceholderCover(currentStory.title_telugu, currentStory.genre)}
        alt={currentStory.title_telugu}
        className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0 bg-stone-100"
        onError={(e) => {
          (e.target as HTMLImageElement).src = getPlaceholderCover(currentStory.title_telugu, currentStory.genre);
        }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-[14px] font-semibold text-[#1A2E2B] font-telugu truncate leading-tight">
          {currentStory.title_telugu}
        </h4>
        <p className="text-[12px] text-[#627571] truncate mt-0.5">
          {currentStory.narrator?.display_name || 'కథకుడు'} · {currentStory.genre}
        </p>
      </div>

      {/* Play/Pause Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center flex-shrink-0 shadow-sm transition-transform tap-target"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current translate-x-0.5" />
        )}
      </button>

      {/* Close/Dismiss Miniplayer */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismissMiniPlayer();
        }}
        className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 flex items-center justify-center flex-shrink-0 -mr-1"
        aria-label="Dismiss player"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
