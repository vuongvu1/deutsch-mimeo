import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { de } from './locales/de'
import { en } from './locales/en'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mimeo:lang',
    },
    returnObjects: true,
  })

export { i18n }
export type Locale = 'de' | 'en'
