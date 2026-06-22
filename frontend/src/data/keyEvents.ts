export interface KeyEvent {
  date: string; // YYYY-MM-DD, Israel local date
  he: string; // 1-3 words
  en: string; // 1-3 words
}

// Hand-curated, real documented events (not GDELT-derived) with a short bilingual
// label, per the user's request for prominent short-title markers on the timeline.
//
// CLAUDE.md Hard Rule #1 (never invent data) applies to DATES too, not just whether
// an event happened. Everything below is a real, widely-documented event; the risk is
// date precision, so this list is meant to be reviewed/corrected by the project owner.
// The GDELT auto-news (red dots) remains the exhaustive secondary layer — this is just
// the sparse "headline" layer.
//
// NOTE: events from 2025 onward (marked) are near/after the assistant's knowledge
// horizon — verify these dates especially before trusting them.
export const KEY_EVENTS: KeyEvent[] = [
  { date: '2023-10-07', he: '7 באוקטובר', en: 'Oct. 7 attack' },
  { date: '2023-10-27', he: 'פלישה קרקעית', en: 'Ground invasion' },
  { date: '2023-11-24', he: 'עסקת חטופים ראשונה', en: 'First hostage deal' },
  { date: '2024-04-01', he: 'תקיפת דמשק', en: 'Damascus strike' },
  { date: '2024-04-14', he: 'תקיפת איראן', en: 'Iran strikes Israel' },
  { date: '2024-07-31', he: 'חיסול הניה', en: 'Haniyeh killed' },
  { date: '2024-09-17', he: 'מבצע הביפרים', en: 'Pager attack' },
  { date: '2024-09-27', he: 'חיסול נסראללה', en: 'Nasrallah killed' },
  { date: '2024-10-01', he: 'מתקפת טילים איראנית', en: 'Iran missile barrage' },
  { date: '2024-10-16', he: 'חיסול סינוואר', en: 'Sinwar killed' },
  { date: '2024-11-27', he: 'הפסקת אש בלבנון', en: 'Lebanon ceasefire' },
  { date: '2025-01-19', he: 'הפסקת אש בעזה', en: 'Gaza ceasefire' },
  // --- verify dates below (2025+) ---
  { date: '2025-06-13', he: 'מלחמה עם איראן', en: 'Iran war begins' },
  { date: '2025-06-22', he: 'תקיפה אמריקאית', en: 'US strikes Iran' },
  { date: '2025-06-24', he: 'הפסקת אש עם איראן', en: 'Iran ceasefire' },
];
