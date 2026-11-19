'use client';

import React, { useState } from 'react';
import { Search, Trophy, Play, Volume2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAudio } from '@/context/AudioContext';
import { DataService } from '@/lib/data-service';
import { GENRES, formatDuration } from '@/lib/constants';
import { Genre } from '@/lib/types';
import { getPlaceholderCover } from '@/lib/illustrations';

interface HomeViewProps {
  onNavigateTab: (tab: 'home' | 'listen' | 'upload' | 'profile') => void;
  onOpenWinner: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateTab, onOpenWinner }) => {
  const { currentUser } = useAuth();
  const { playStory, currentStory, isPlaying, isMiniPlayerActive } = useAudio();

  const [selectedGenre, setSelectedGenre] = useState<Genre>('Folk Tales');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const storyOfTheWeek = DataService.getStoryOfTheWeek();
  const allStories = DataService.getStories({
    genre: selectedGenre,
    search: searchQuery,
    sort: 'most_voted',
  });

  // Filter out the story of the week from the lower list to avoid duplication if it's there
  const unwindStories = allStories.filter((s) => s.id !== storyOfTheWeek?.id).slice(0, 6);

  const firstName = currentUser?.display_name?.split(' ')[0] || 'Saanvi';

  return (
    <div
      className={`w-full flex flex-col ${
        isMiniPlayerActive ? 'page-bottom-padding-with-mini' : 'page-bottom-padding'
      }`}
    >
      {/* Top Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#1A2E2B] tracking-tight">
              Namaskaram, {firstName}
            </h1>
            <p className="text-[15px] text-[#627571] font-medium mt-0.5">
              A story for today.
            </p>
          </div>

          {/* Round Waveform Icon Top Right (as in original design) */}
          <button
            onClick={onOpenWinner}
            className="w-11 h-11 rounded-full bg-[#E5F2F0] hover:bg-[#D5EAE7] active:scale-95 text-teal-800 flex items-center justify-center transition-all shadow-sm tap-target flex-shrink-0"
            aria-label="Story of the Week & Weekly Winner"
            title="Weekly Winner & Audio Waves"
          >
            <div className="flex items-center gap-[3px] h-4">
              <span className="w-[3px] h-2.5 bg-teal-700 rounded-full animate-pulse" />
              <span className="w-[3px] h-4 bg-teal-700 rounded-full animate-pulse delay-75" />
              <span className="w-[3px] h-3 bg-teal-700 rounded-full animate-pulse delay-150" />
              <span className="w-[3px] h-4 bg-teal-700 rounded-full animate-pulse delay-200" />
              <span className="w-[3px] h-2 bg-teal-700 rounded-full animate-pulse" />
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[#7A8B86]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories or narrators"
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-[#EFEBE4] text-[15px] text-[#1A2E2B] placeholder-[#8A9A95] shadow-card focus:outline-none focus:border-teal-600 transition-all"
          />
        </div>

        {/* Horizontal Scrollable Genre Chips (Pill shaped 44px, no-scrollbar, 8-10px gap) */}
        <div className="mt-4 -mx-5 px-5 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {GENRES.map((genre) => {
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`h-[44px] px-5 rounded-full text-sm font-semibold whitespace-nowrap flex-none transition-all flex items-center justify-center ${
                  isSelected
                    ? 'bg-[#1F7A6D] text-white shadow-sm border border-[#1F7A6D]'
                    : 'bg-white text-[#1A2E2B] border border-[#EAE5DC] hover:border-teal-400'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 mt-4 space-y-6">
        {/* STORY OF THE WEEK CARD */}
        {storyOfTheWeek && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-[#EFEBE4] relative overflow-hidden transition-all hover:shadow-cardHover">
            {/* Trophy Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-[12px] font-bold mb-3 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>ఈ వారపు కథ · Story of the Week</span>
            </div>

            {/* 16:9 Illustrated Cover and Play Section */}
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-3 bg-[#FAF8F5]">
              <img
                src={storyOfTheWeek.cover_url || getPlaceholderCover(storyOfTheWeek.title_telugu, storyOfTheWeek.genre)}
                alt={storyOfTheWeek.title_telugu}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getPlaceholderCover(storyOfTheWeek.title_telugu, storyOfTheWeek.genre);
                }}
              />

              {/* Round Play Button */}
              <button
                onClick={() => playStory(storyOfTheWeek)}
                className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
                aria-label={`Play ${storyOfTheWeek.title_telugu}`}
              >
                {currentStory?.id === storyOfTheWeek.id && isPlaying ? (
                  <Volume2 className="w-6 h-6 animate-pulse" />
                ) : (
                  <Play className="w-6 h-6 fill-current translate-x-0.5" />
                )}
              </button>
            </div>

            {/* Title & Metadata */}
            <div>
              <h2 className="text-[19px] font-bold text-[#1A2E2B] font-telugu leading-[1.5] line-clamp-2">
                {storyOfTheWeek.title_telugu}
              </h2>

              <p className="text-[13px] text-[#627571] mt-1 font-medium">
                By {storyOfTheWeek.narrator?.display_name || 'Saanvi'}
                {storyOfTheWeek.narrator?.show_age_city && storyOfTheWeek.narrator?.age
                  ? `, age ${storyOfTheWeek.narrator.age}`
                  : storyOfTheWeek.narrator?.age ? `, age ${storyOfTheWeek.narrator.age}` : ''}{' '}
                · {formatDuration(storyOfTheWeek.duration_seconds)}
              </p>

              {/* Votes social proof */}
              <p className="text-[13px] text-teal-700 font-semibold mt-1 flex items-center gap-1.5">
                <span>
                  {storyOfTheWeek.vote_count?.toLocaleString()} votes · This week&apos;s favourite
                </span>
              </p>
            </div>
          </div>
        )}

        {/* LISTEN & UNWIND SECTION */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-[#1A2E2B] tracking-tight">
              Listen & unwind
            </h3>
            <button
              onClick={() => onNavigateTab('listen')}
              className="text-sm font-bold text-teal-700 hover:text-teal-800 transition-colors tap-target"
            >
              See all
            </button>
          </div>

          {/* Story Rows List */}
          <div className="space-y-2.5">
            {unwindStories.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-[#EFEBE4] text-center text-sm text-[#7A8B86]">
                ఈ విభాగంలో కథలు లేవు (No stories found for this genre).
              </div>
            ) : (
              unwindStories.map((story) => {
                const isThisPlaying = currentStory?.id === story.id && isPlaying;
                return (
                  <div
                    key={story.id}
                    onClick={() => playStory(story)}
                    className="bg-white rounded-2xl p-3 shadow-card border border-[#EFEBE4] flex items-center gap-3.5 cursor-pointer transition-all hover:shadow-cardHover active:scale-[0.99]"
                  >
                    {/* Thumbnail */}
                    <img
                      src={story.cover_url || getPlaceholderCover(story.title_telugu, story.genre)}
                      alt={story.title_telugu}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-stone-100"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getPlaceholderCover(story.title_telugu, story.genre);
                      }}
                    />

                    {/* Story Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-bold text-[#1A2E2B] font-telugu line-clamp-2 leading-[1.5]">
                        {story.title_telugu}
                      </h4>
                      <p className="text-[12px] text-[#627571] truncate mt-0.5 font-medium">
                        {story.narrator?.display_name || 'కథకుడు'}
                        {story.narrator?.show_age_city && story.narrator?.age
                          ? ` · age ${story.narrator.age}`
                          : story.narrator?.age ? ` · age ${story.narrator.age}` : ''}{' '}
                        · {formatDuration(story.duration_seconds)}
                      </p>
                      <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                        {story.genre} · {story.vote_count} votes
                      </p>
                    </div>

                    {/* Outlined Play Icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playStory(story);
                      }}
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
