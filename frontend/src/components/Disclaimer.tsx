import { useLanguage } from '../i18n/LanguageContext';

// Legal/ethical disclaimer + attribution (SPEC.md §9, CLAUDE.md Hard Rule #7) — must
// stay present in the UI, not just a one-time stage-6 polish item.
export function Disclaimer() {
  const { lang, t } = useLanguage();

  return (
    <details className="disclaimer">
      <summary>{t('disclaimerSummary')}</summary>
      {lang === 'he' ? (
        <>
          <p>
            זהו פרויקט פרטי ולא רשמי. הוא <strong>אינו</strong> כלי התרעה ואינו אמין למידע
            בזמן אמת — אין להסתמך עליו לצורכי ביטחון. הוא מציג היסטוריה תיאורית בלבד, ועוצר
            בסוף היום הקודם. הקואורדינטות הן מרכזי איזורי התרעה ולא נקודות פגיעה, ומספרי
            ההתרעות משקפים אזעקות (צבע אדום) ולא פגיעות מאושרות.
          </p>
          <p>
            מקורות ותודות: Tzofar/tzevaadom (התרעות), GDELT וויקיפדיה (חדשות), מפת הרקע ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            ו-
            <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
              CARTO
            </a>
            . כותרות החדשות (GDELT וויקיפדיה) עשויות לכלול טקסט באנגלית ממקורות שונים.
          </p>
        </>
      ) : (
        <>
          <p>
            This is a private, unofficial project. It is <strong>not</strong> an alerting tool
            and is not reliable for real-time information — do not rely on it for safety
            purposes. It shows descriptive history only, and stops at the end of the previous
            day. Coordinates are alert-zone centroids, not impact points, and alert counts
            reflect sirens (Code Red) rather than confirmed impacts.
          </p>
          <p>
            Sources & credits: Tzofar/tzevaadom (alerts), GDELT & Wikipedia (news), basemap ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            &{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
              CARTO
            </a>
            . News (GDELT & Wikipedia) may include English-language headlines from various sources.
          </p>
        </>
      )}
    </details>
  );
}
