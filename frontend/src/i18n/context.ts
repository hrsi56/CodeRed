import { createContext } from 'react';
import type { Lang, StringKey } from './strings';

export interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);
