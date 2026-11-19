import { Genre } from './types';

export const GENRES: Genre[] = [
  'All',
  'Folk Tales',
  'Moral Stories',
  'Mythology',
  'Panchatantra',
  'Tenali Rama',
  'Bedtime',
];

export const REJECT_PRESET_REASONS = [
  {
    id: 'audio_unclear',
    label: 'Audio unclear · Low volume',
    explanation: 'The narration was hard to hear. Please speak closer to the microphone in a quiet room.',
  },
  {
    id: 'background_noise',
    label: 'Background noise · Fan / Echo',
    explanation: 'There was prominent background fan noise, traffic, or echo. Try recording in a furnished bedroom.',
  },
  {
    id: 'language_mismatch',
    label: 'Telugu language required',
    explanation: 'Kathalu is dedicated to stories narrated in Telugu. Please record your story in Telugu.',
  },
  {
    id: 'inappropriate_content',
    label: 'Content not suitable for children',
    explanation: 'The story contains themes or words not aligned with our family-friendly community guidelines.',
  },
  {
    id: 'copyrighted_music',
    label: 'Copyrighted background music',
    explanation: 'Please avoid playing copyrighted songs or film audio in the background.',
  },
  {
    id: 'minor_guardian_needed',
    label: 'Guardian verification needed',
    explanation: 'Under-18 narrators require guardian consent details before publishing.',
  },
];

/**
 * Returns the current Monday YYYY-MM-DD in Asia/Kolkata (IST: UTC+5:30)
 */
export function getCurrentISTWeekStart(date: Date = new Date()): string {
  // Convert date to IST
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);

  // Day 0 is Sunday, Day 1 is Monday ... Day 6 is Saturday
  const day = istDate.getDay();
  // In Monday-first week: Monday is 0 offset, Tuesday is 1, ..., Sunday is 6
  const diffToMonday = day === 0 ? 6 : day - 1;

  const monday = new Date(istDate);
  monday.setDate(istDate.getDate() - diffToMonday);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

/**
 * Returns formatted week start and end strings
 */
export function getCurrentISTWeekRange(date: Date = new Date()): {
  weekStart: string;
  weekEnd: string;
  formattedRange: string;
} {
  const weekStart = getCurrentISTWeekStart(date);
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const endYear = endDate.getFullYear();
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endD = String(endDate.getDate()).padStart(2, '0');
  const weekEnd = `${endYear}-${endMonth}-${endD}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startStr = `${monthNames[startDate.getMonth()]} ${startDate.getDate()}`;
  const endStr = `${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${endYear}`;

  return {
    weekStart,
    weekEnd,
    formattedRange: `${startStr} – ${endStr}`,
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
