export type Lang = 'he' | 'en';

type Dict = Record<string, { he: string; en: string }>;

// Flat UI strings. Data fields (locality names, ACLED event types, GDELT headlines)
// are NOT here — those live with the data and are handled per-field (see useLanguage
// callers that pick .he/.en directly, or fall back to the source language when no
// translation exists).
export const strings = {
  appTitle: { he: 'מפת התרעות צבע אדום — היסטוריה', en: 'Code Red Alert Map — History' },
  loading: { he: 'טוען נתונים…', en: 'Loading data…' },
  errorPrefix: { he: 'שגיאה בטעינת הנתונים', en: 'Error loading data' },
  noDataYet: {
    he: 'אין עדיין נתונים זמינים — תהליך העדכון היומי עדיין לא רץ בהצלחה.',
    en: 'No data available yet — the daily update job has not completed successfully yet.',
  },

  layerHeatmap: { he: 'מפת חום', en: 'Heatmap' },
  lockScales: { he: 'נעילת קנה־מידה', en: 'Lock scale' },
  removeComparison: { he: 'הסר השוואה', en: 'Remove comparison' },
  addComparison: { he: 'הוסף השוואה', en: 'Add comparison' },
  panelA: { he: 'טווח א׳', en: 'Range A' },
  panelB: { he: 'טווח ב׳', en: 'Range B' },

  freshnessUnavailable: {
    he: 'אין עדיין נתונים זמינים — ייתכן שתהליך העדכון היומי עדיין לא רץ.',
    en: 'No data available yet — the daily update job may not have run yet.',
  },

  disclaimerSummary: { he: 'גילוי נאות ומקורות', en: 'Disclosure & sources' },

  statAlertsInRange: { he: 'התרעות בטווח', en: 'Alerts in range' },
  statAvgPerDay: { he: 'ממוצע ליום', en: 'Avg / day' },
  statLocalitiesHit: { he: 'יישובים מותקפים', en: 'Localities hit' },
  statZonesHit: { he: 'אזורים נפגעים', en: 'Zones hit' },
  hourChartHeading: { he: 'התרעות לפי שעה ביממה', en: 'Alerts by hour of day' },
  tooltipAlerts: { he: 'התרעות', en: 'Alerts' },
  tooltipHourPrefix: { he: 'שעה', en: 'Hour' },
  topCitiesHeading: { he: 'יישובים מובילים (לפי כלל ה-MAX)', en: 'Top localities (MAX rule)' },
  noAlertsInRange: { he: 'אין התרעות בטווח שנבחר.', en: 'No alerts in the selected range.' },

  deltaAlerts: { he: 'התרעות (א׳→ב׳)', en: 'Alerts (A→B)' },
  deltaPeakHour: { he: 'שעת שיא', en: 'Peak hour' },
  deltaTopLocality: { he: 'יישוב מוביל', en: 'Top locality' },

  timelineCloseAria: { he: 'סגור', en: 'Close' },
  presetDayOf: { he: 'יום האירוע', en: 'Day of' },
  presetWeekAfter: { he: 'שבוע אחרי', en: 'Week after' },
  presetAroundDays: { he: '±3 ימים', en: '±3 days' },
  prevMonth: { he: 'החודש הקודם', en: 'Previous month' },
  nextMonth: { he: 'החודש הבא', en: 'Next month' },
  jumpToLatest: { he: 'להווה', en: 'Jump to present' },
  rawHeadlinesLabel: { he: 'כותרות חדשות', en: 'News headlines' },
  legendNews: { he: 'חדשות', en: 'News' },
  legendKeyEvent: { he: 'אירוע מרכזי', en: 'Key event' },
} satisfies Dict;

export type StringKey = keyof typeof strings;

export const localeOf = (lang: Lang) => (lang === 'he' ? 'he-IL' : 'en-US');

// Locality/zone names: tzevaadom gives an English name for most (not all) entries —
// synthesized base cities (centroid of several sub-areas) have none. Fall back to
// Hebrew rather than fabricating a translation (CLAUDE.md Hard Rule #1).
export const localizedName = (lang: Lang, he: string, en: string | null | undefined): string =>
  lang === 'en' && en ? en : he;
