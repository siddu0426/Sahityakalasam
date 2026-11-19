'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Story } from '../lib/types';
import { DataService } from '../lib/data-service';

interface AudioContextType {
  currentStory: Story | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  isNowListeningOpen: boolean;
  isMiniPlayerActive: boolean;
  playStory: (story: Story) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  skip: (seconds: number) => void; // ±10 seconds
  openNowListening: () => void;
  closeNowListening: () => void;
  dismissMiniPlayer: () => void;
  voteCurrentStory: () => { success: boolean; message: string; hasVoted: boolean };
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isNowListeningOpen, setIsNowListeningOpen] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isMiniPlayerActive = Boolean(currentStory && !isNowListeningOpen && !isDismissed);

  const dismissMiniPlayer = () => {
    pause();
    setIsDismissed(true);
  };

  // Initialize Audio element once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if ('mediaSession' in navigator && audio.duration) {
        try {
          navigator.mediaSession.setPositionState?.({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch (e) {
          // ignore unsupported position state
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || currentStory?.duration_seconds || 0);
      setIsLoading(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      console.warn('Audio playback error on url:', audio.src);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Update Media Session API when story changes
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentStory) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStory.title_telugu,
      artist: currentStory.narrator?.display_name || 'కథకుడు (Narrator)',
      album: 'Kathalu · తెలుగు కథలు',
      artwork: [
        { src: currentStory.cover_url, sizes: '96x96', type: 'image/jpeg' },
        { src: currentStory.cover_url, sizes: '256x256', type: 'image/jpeg' },
        { src: currentStory.cover_url, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      skip(-(details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      skip(details.seekOffset || 10);
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seek(details.seekTime);
      }
    });

    return () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [currentStory]);

  const playStory = (story: Story) => {
    if (!audioRef.current) return;

    // Check if it's already the current story
    if (currentStory?.id === story.id) {
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
      }
      setIsNowListeningOpen(true);
      return;
    }

    // New story
    setCurrentStory(story);
    setDuration(story.duration_seconds || 0);
    setCurrentTime(0);
    setIsLoading(true);
    setIsDismissed(false);

    audioRef.current.src = story.audio_url;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Playback error (e.g. autoplay blocked):', err);
        setIsPlaying(false);
        setIsLoading(false);
      });

    setIsNowListeningOpen(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src && currentStory) {
        audioRef.current.src = currentStory.audio_url;
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.warn);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(seconds, duration || audioRef.current.duration || 9999));
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    seek(audioRef.current.currentTime + seconds);
  };

  const openNowListening = () => setIsNowListeningOpen(true);
  const closeNowListening = () => setIsNowListeningOpen(false);

  const voteCurrentStory = (): { success: boolean; message: string; hasVoted: boolean } => {
    if (!currentStory) {
      return { success: false, message: 'No story playing', hasVoted: false };
    }
    const currentUser = DataService.getCurrentUser();
    const result = DataService.voteForStory(currentUser.id, currentStory.id);

    if (result.success) {
      setCurrentStory((prev) =>
        prev
          ? {
              ...prev,
              vote_count: result.newVoteCount,
              user_has_voted: result.hasVoted,
            }
          : null
      );
    }
    return result;
  };

  return (
    <AudioContext.Provider
      value={{
        currentStory,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        isNowListeningOpen,
        isMiniPlayerActive,
        playStory,
        togglePlay,
        pause,
        seek,
        skip,
        openNowListening,
        closeNowListening,
        dismissMiniPlayer,
        voteCurrentStory,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
