import { useLanguage } from '../i18n/LanguageContext';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="lang-toggle" role="group" aria-label="שפה / Language">
      <button
        type="button"
        className={lang === 'he' ? 'active' : ''}
        onClick={() => setLang('he')}
        aria-pressed={lang === 'he'}
        title="עברית"
      >
        🇮🇱 עב
      </button>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        title="English"
      >
        🇬🇧 EN
      </button>
    </div>
  );
}
