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
            ההתרעות משקפים אזעקות (צבע אדום) ולא פגיעות מאושרות. נתוני ההרוגים הם הערכות{' '}
            <em>מדווחות</em> ברמת אירוע מ-ACLED — לא מרשם קורבנות מאומת בשם, ושיטת הקידוד
            שלהם לסכסוך הזה נתונה במחלוקת מתודולוגית.
          </p>
          <p>
            מקורות ותודות: Tzofar/tzevaadom (התרעות), ACLED (הרוגים — שימוש לא מסחרי וחובת
            קרדיט), GDELT (חדשות), מפת הרקע ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            ו-
            <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
              CARTO
            </a>
            . חדשות מ-GDELT עשויות לכלול כותרות באנגלית ממקורות שונים.
          </p>
        </>
      ) : (
        <>
          <p>
            This is a private, unofficial project. It is <strong>not</strong> an alerting tool
            and is not reliable for real-time information — do not rely on it for safety
            purposes. It shows descriptive history only, and stops at the end of the previous
            day. Coordinates are alert-zone centroids, not impact points, and alert counts
            reflect sirens (Code Red) rather than confirmed impacts. Fatality data are{' '}
            <em>reported</em> event-level estimates from ACLED — not a verified named-victim
            registry, and their coding methodology for this conflict is subject to
            methodological dispute.
          </p>
          <p>
            Sources & credits: Tzofar/tzevaadom (alerts), ACLED (fatalities — non-commercial
            use, attribution required), GDELT (news), basemap ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            &{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
              CARTO
            </a>
            . News from GDELT may include English-language headlines from various sources.
          </p>
        </>
      )}
    </details>
  );
}
