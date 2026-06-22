import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { strings, type Lang } from './strings';
import { LanguageContext, type LanguageContextValue } from './context';

const STORAGE_KEY = 'codered-lang';

function detectInitialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return saved === 'he' || saved === 'en' ? saved : 'he';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
      t: (key) => strings[key][lang],
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
