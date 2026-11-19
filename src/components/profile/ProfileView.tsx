'use client';

import React, { useState } from 'react';
import {
  Settings,
  Edit2,
  Heart,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  LogOut,
  X,
  ShieldCheck,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAudio } from '@/context/AudioContext';
import { DataService } from '@/lib/data-service';
import { formatDuration } from '@/lib/constants';
import { Story } from '@/lib/types';
import { getPlaceholderCover } from '@/lib/illustrations';

interface ProfileViewProps {
  onResubmitStory: (story: Story) => void;
  onOpenNotifications: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onResubmitStory,
  onOpenNotifications,
}) => {
  const { currentUser, logout, updateProfile } = useAuth();
  const { playStory, isMiniPlayerActive } = useAudio();

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [selectedRejectedStory, setSelectedRejectedStory] = useState<Story | null>(null);

  // Edit fields
  const [editName, setEditName] = useState<string>(currentUser?.display_name || '');
  const [editBio, setEditBio] = useState<string>(currentUser?.bio || '');
  const [editCity, setEditCity] = useState<string>(currentUser?.city || '');
  const [editShowAgeCity, setEditShowAgeCity] = useState<boolean>(currentUser?.show_age_city ?? false);

  const stories = currentUser ? DataService.getNarratorStories(currentUser.id) : [];
  const notifications = currentUser ? DataService.getNotifications(currentUser.id) : [];
  const unreadNotifs = notifications.filter((n) => !n.is_read).length;

  const totalStories = stories.length;
  const totalVotes = stories.reduce((acc, s) => acc + (s.vote_count || 0), 0);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    updateProfile({
      display_name: editName.trim(),
      bio: editBio.trim(),
      city: editCity.trim(),
      show_age_city: editShowAgeCity,
    });
    setIsEditProfileOpen(false);
  };

  return (
    <div
      className={`w-full flex flex-col px-5 pt-6 ${
        isMiniPlayerActive ? 'page-bottom-padding-with-mini' : 'page-bottom-padding'
      }`}
    >
      {/* Title with Settings and Notification Icons */}
      <div className="flex items-center justify-between pb-3">
        <h1 className="text-2xl font-bold text-[#1A2E2B]">My profile</h1>

        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <button
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center text-[#627571] hover:text-teal-700 transition-colors relative tap-target"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center text-[#627571] hover:text-teal-700 transition-colors tap-target"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Avatar, Name, @username & Edit icon */}
      <div className="flex flex-col items-center mt-3 text-center">
        <div className="relative">
          <img
            src={
              currentUser?.avatar_url ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser?.id || 'default'}`
            }
            alt={currentUser?.display_name || 'Profile'}
            className="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-teal-600/30 bg-[#FAF8F5]"
          />
          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 tap-target"
            aria-label="Edit Profile"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-xl font-bold text-[#1A2E2B] font-telugu">
              {currentUser?.display_name || 'కథకుడు'}
            </h2>
            {currentUser?.is_minor && (
              <span title="Guardian Verified">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </span>
            )}
          </div>
          <p className="text-sm text-[#7A8B86] font-medium">@{currentUser?.username || 'user'}</p>
          {currentUser?.bio && (
            <p className="text-xs text-[#556964] mt-1.5 max-w-xs leading-relaxed">
              {currentUser.bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats Panel (Stories shared, Listener votes) */}
      <div className="mt-6 bg-[#E5F2F0] rounded-2xl p-4 flex items-center justify-around border border-teal-100 shadow-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-teal-900">{totalStories}</div>
          <div className="text-xs font-semibold text-teal-800 mt-0.5">Stories shared</div>
        </div>

        <div className="w-[1px] h-8 bg-teal-200" />

        <div className="text-center">
          <div className="text-2xl font-bold text-teal-900">
            {totalVotes.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-teal-800 mt-0.5">Listener votes</div>
        </div>
      </div>

      {/* "My stories" List */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#1A2E2B] tracking-tight">
            My stories
          </h3>
          <span className="text-xs text-[#7A8B86] font-medium">
            {stories.length} total
          </span>
        </div>

        <div className="space-y-3">
          {stories.length === 0 ? (
            <div className="p-6 bg-white rounded-2xl border border-[#EFEBE4] text-center text-sm text-[#7A8B86]">
              మీరు ఇంకా కథలు చెప్పలేదు (You haven&apos;t shared any stories yet). Tap Upload to begin!
            </div>
          ) : (
            stories.map((story) => {
              const formattedDate = new Date(story.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={story.id}
                  className="bg-white rounded-2xl p-3.5 shadow-card border border-[#EFEBE4] flex flex-col gap-2 transition-all hover:shadow-cardHover"
                >
                  <div className="flex items-center gap-3">
                    {/* Cover */}
                    <img
                      src={story.cover_url || getPlaceholderCover(story.title_telugu, story.genre)}
                      alt={story.title_telugu}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0 cursor-pointer bg-stone-100"
                      onClick={() => playStory(story)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getPlaceholderCover(story.title_telugu, story.genre);
                      }}
                    />

                    {/* Details */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => playStory(story)}
                    >
                      <h4 className="text-[15px] font-bold text-[#1A2E2B] font-telugu line-clamp-2 leading-[1.5]">
                        {story.title_telugu}
                      </h4>
                      <p className="text-[12px] text-[#627571] mt-0.5">
                        {formattedDate} · {formatDuration(story.duration_seconds)}
                      </p>
                    </div>

                    {/* Status Tag */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {story.status === 'live' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Live
                        </span>
                      )}
                      {story.status === 'pending' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> In Review
                        </span>
                      )}
                      {story.status === 'rejected' && (
                        <button
                          onClick={() => setSelectedRejectedStory(story)}
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 transition-colors flex items-center gap-1 tap-target"
                        >
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </button>
                      )}

                      {/* Vote Count */}
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#627571]">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span>{story.vote_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rejected Row Reason line (MATCHING SCREENSHOT) */}
                  {story.status === 'rejected' && (
                    <div
                      onClick={() => setSelectedRejectedStory(story)}
                      className="mt-1 p-2 bg-rose-50/90 rounded-xl border border-rose-200/80 text-rose-800 text-[12px] font-medium flex items-center justify-between cursor-pointer hover:bg-rose-100/90 transition-colors"
                    >
                      <span className="truncate">
                        {story.reject_reason || 'Audio unclear'} · Tap to review
                      </span>
                      <RotateCcw className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 ml-1" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Line (EXACTLY MATCHING DESIGN SCREENSHOT) */}
      <div className="mt-8 text-center text-xs text-[#7A8B86] font-medium pb-4">
        Your voice makes someone&apos;s day.
      </div>

      {/* REJECTED REASON & FREE RESUBMIT MODAL */}
      {selectedRejectedStory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-start pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base font-telugu">
                  {selectedRejectedStory.title_telugu}
                </h3>
                <span className="text-xs text-rose-600 font-semibold">
                  Editorial Feedback & Free Resubmission
                </span>
              </div>
              <button
                onClick={() => setSelectedRejectedStory(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1">
                <div className="font-bold">
                  Reason: {selectedRejectedStory.reject_reason}
                </div>
                <p className="text-rose-700">
                  {selectedRejectedStory.reject_notes ||
                    'Please re-record with clearer audio in a quiet room.'}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>No fee required! You can revise and submit this story for free.</span>
              </div>

              <button
                onClick={() => {
                  const s = selectedRejectedStory;
                  setSelectedRejectedStory(null);
                  onResubmitStory(s);
                }}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all tap-target flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-record & Resubmit For Free</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Edit Profile</h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-sm"
                />
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editShowAgeCity}
                  onChange={(e) => setEditShowAgeCity(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded mt-0.5"
                />
                <span className="text-xs text-gray-700">
                  Show my age and city on my stories
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm mt-2 tap-target"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SETTINGS / LOGOUT DRAWER */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Account Settings</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2">
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsEditProfileOpen(true);
                }}
                className="w-full p-3 rounded-xl hover:bg-stone-50 text-left text-sm font-semibold text-gray-800 flex items-center justify-between tap-target"
              >
                <span>Edit Profile & Child Consent</span>
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  logout();
                }}
                className="w-full p-3 rounded-xl hover:bg-rose-50 text-left text-sm font-bold text-rose-600 flex items-center justify-between tap-target"
              >
                <span>Log Out</span>
                <LogOut className="w-4 h-4 text-rose-500" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
