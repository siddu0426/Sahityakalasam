'use client';

import React, { useState, useEffect } from 'react';
import { Search, Play, Volume2, ArrowUpDown, Filter } from 'lucide-react';
import { useAudio } from '@/context/AudioContext';
import { DataService } from '@/lib/data-service';
import { GENRES, formatDuration } from '@/lib/constants';
import { Genre } from '@/lib/types';
import { getPlaceholderCover } from '@/lib/illustrations';

export const ListenView: React.FC = () => {
  const { playStory, currentStory, isPlaying, isMiniPlayerActive } = useAudio();

  const [selectedGenre, setSelectedGenre] = useState<Genre>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'most_voted' | 'newest'>('most_voted');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Simulate skeleton loading state for low-end devices
  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(t);
  }, [selectedGenre, sortBy]);

  const stories = DataService.getStories({
    genre: selectedGenre,
    search: searchQuery,
    sort: sortBy,
    status: 'live',
  });

  return (
    <div
      className={`w-full flex flex-col px-5 pt-6 ${
        isMiniPlayerActive ? 'page-bottom-padding-with-mini' : 'page-bottom-padding'
      }`}
    >
      {/* Title */}
      <h1 className="text-2xl font-bold text-[#1A2E2B] font-telugu">
        అన్వేషించండి · Listen & Discover
      </h1>
      <p className="text-[14px] text-[#627571] font-medium mt-0.5">
        Explore authentic Telugu stories shared by community narrators
      </p>

      {/* Search Bar */}
      <div className="mt-4 relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[#7A8B86]">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, narrator, or city..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-[#EFEBE4] text-sm text-[#1A2E2B] placeholder-[#8A9A95] shadow-card focus:outline-none focus:border-teal-600 transition-all"
        />
      </div>

      {/* Genre Chips (Pill shaped 44px, no-scrollbar, 8-10px gap) */}
      <div className="mt-3.5 -mx-5 px-5 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {GENRES.map((g) => {
          const isSelected = selectedGenre === g;
          return (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`h-[44px] px-5 rounded-full text-sm font-semibold whitespace-nowrap flex-none transition-all flex items-center justify-center ${
                isSelected
                  ? 'bg-[#1F7A6D] text-white shadow-sm border border-[#1F7A6D]'
                  : 'bg-white text-[#1A2E2B] border border-[#EAE5DC] hover:border-teal-400'
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      {/* Sort & Count Header */}
      <div className="mt-4 flex items-center justify-between text-xs text-[#627571] font-medium">
        <span>{stories.length} stories available</span>

        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#EFEBE4] shadow-sm">
          <ArrowUpDown className="w-3.5 h-3.5 text-teal-700" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-xs font-bold text-[#1A2E2B] focus:outline-none cursor-pointer"
          >
            <option value="most_voted">Most Voted</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </div>

      {/* Skeleton Loading State */}
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-3.5 shadow-card border border-[#EFEBE4] flex items-center gap-3 animate-pulse"
            >
              <div className="w-16 h-16 rounded-xl bg-stone-200" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-4 bg-stone-200 rounded" />
                <div className="w-1/2 h-3 bg-stone-100 rounded" />
                <div className="w-1/3 h-3 bg-teal-50 rounded" />
              </div>
              <div className="w-9 h-9 rounded-full bg-stone-200" />
            </div>
          ))}
        </div>
      ) : stories.length === 0 ? (
        /* Empty State */
        <div className="mt-8 p-8 bg-white rounded-2xl border border-[#EFEBE4] text-center space-y-3 shadow-card">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-[#1A2E2B] text-base">కథలు కనుగొనబడలేదు</h4>
          <p className="text-xs text-[#7A8B86] max-w-xs mx-auto">
            No stories match your search or genre filter. Try clearing the search or exploring another category.
          </p>
          <button
            onClick={() => {
              setSelectedGenre('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl text-xs hover:bg-teal-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Stories Grid / List */
        <div className="mt-4 space-y-3">
          {stories.map((story) => {
            const isThisPlaying = currentStory?.id === story.id && isPlaying;

            return (
              <div
                key={story.id}
                onClick={() => playStory(story)}
                className="bg-white rounded-2xl p-3.5 shadow-card border border-[#EFEBE4] flex items-center gap-3.5 cursor-pointer transition-all hover:shadow-cardHover active:scale-[0.99]"
              >
                {/* Cover with fallback */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100">
                  <img
                    src={story.cover_url || getPlaceholderCover(story.title_telugu, story.genre)}
                    alt={story.title_telugu}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getPlaceholderCover(story.title_telugu, story.genre);
                    }}
                  />
                  {story.is_weekly_winner && (
                    <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded shadow-sm">
                      🏆
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-[#1A2E2B] font-telugu line-clamp-2 leading-[1.5]">
                    {story.title_telugu}
                  </h3>
                  <p className="text-[12px] text-[#627571] truncate mt-0.5">
                    {story.narrator?.display_name || 'కథకుడు'}
                    {story.narrator?.show_age_city && story.narrator?.age
                      ? ` · age ${story.narrator.age}`
                      : story.narrator?.age ? ` · age ${story.narrator.age}` : ''}{' '}
                    · {formatDuration(story.duration_seconds)}
                  </p>
                  <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                    {story.genre} · {story.vote_count?.toLocaleString()} votes
                  </p>
                </div>

                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playStory(story);
                  }}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isThisPlaying
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-[#CAD8D5] text-teal-700 hover:border-teal-600'
                  }`}
                  aria-label={`Play ${story.title_telugu}`}
                >
                  {isThisPlaying ? (
                    <Volume2 className="w-4 h-4 animate-pulse text-teal-700" />
                  ) : (
                    <Play className="w-4 h-4 fill-current translate-x-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
