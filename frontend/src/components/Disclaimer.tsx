// Legal/ethical disclaimer + attribution (SPEC.md §9, CLAUDE.md Hard Rule #7) — must
// stay present in the UI, not just a one-time stage-6 polish item.
export function Disclaimer() {
  return (
    <details className="disclaimer">
      <summary>גילוי נאות ומקורות</summary>
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
    </details>
  );
}
