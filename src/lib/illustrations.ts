// High quality warm painted folklore illustrations for Telugu stories
// Using warm earth tones, deep teal, ochre, terracotta, and soft gold

export const STORY_COVERS: Record<string, string> = {
  // The Clever Crow (కాకి & కుండ - Painted folklore art)
  crow: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
  // Tenali Rama Golden Mangoes (రాజ దర్బారు చిత్రలేఖనం)
  tenali: 'https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=800&auto=format&fit=crop&q=80',
  // Lion and Mouse (సింహం & ఎలుక)
  lion: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&auto=format&fit=crop&q=80',
  // Grandmother's Moon Tale (చందమామ కథలు)
  moon: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  // Tortoise and Hare (తాబేలు కుందేలు)
  tortoise: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
  // Krishna & Kaliya (శ్రీకృష్ణ లీలలు)
  krishna: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
  // Enchanted Deer (మాయా లేడి)
  deer: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=800&auto=format&fit=crop&q=80',
  // Hanuman (హనుమంతుని లీలలు)
  hanuman: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&auto=format&fit=crop&q=80',
  // Default Warm Painted Story Illustration
  default: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
};

// Generates an inline SVG placeholder illustration in warm Kathalu palette
export function getPlaceholderCover(title: string, genre: string): string {
  const bgColors = ['#264653', '#2A9D8F', '#E76F51', '#F4A261', '#1F7A6D'];
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bg = bgColors[hash % bgColors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#1A2E2B" stop-opacity="0.95"/>
      </linearGradient>
      <pattern id="motif" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="1.5" fill="#FAF8F5" fill-opacity="0.2"/>
      </pattern>
    </defs>
    <rect width="600" height="400" fill="url(#grad)"/>
    <rect width="600" height="400" fill="url(#motif)"/>
    <circle cx="300" cy="170" r="64" fill="#FAF8F5" fill-opacity="0.1"/>
    <path d="M280 140 L330 170 L280 200 Z" fill="#FAF8F5" fill-opacity="0.85"/>
    <text x="300" y="270" font-family="sans-serif" font-weight="bold" font-size="20" fill="#FAF8F5" text-anchor="middle">${genre}</text>
    <text x="300" y="300" font-family="sans-serif" font-size="14" fill="#C7E3DF" text-anchor="middle">కథలు · Kathalu</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

