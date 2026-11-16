import { setLanguage, setupI18nInstance } from '@i18next-toolkit/react';

export const languages = [
  {
    label: 'Tiếng Việt',
    key: 'vi-VN',
  },
  {
    label: 'English',
    key: 'en',
  },
  {
    label: 'Deutsch',
    key: 'de-DE',
  },
  {
    label: 'Español',
    key: 'es-ES',
  },
  {
    label: 'Français',
    key: 'fr-FR',
  },
  {
    label: 'Indonesia',
    key: 'id-ID',
  },
  {
    label: '日本語',
    key: 'ja-JP',
  },
  {
    label: 'Polski',
    key: 'pl-PL',
  },
  {
    label: 'Português',
    key: 'pt-PT',
  },
  {
    label: 'Русский',
    key: 'ru-RU',
  },
  {
    label: 'Türkçe',
    key: 'tr-TR',
  },
  {
    label: '简体中文',
    key: 'zh-CN',
  },
];

export function initI18N() {
  let shouldDefaultToVi = false;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('i18nextLng');
      if (!saved || saved === 'vi') {
        window.localStorage.setItem('i18nextLng', 'vi-VN');
        shouldDefaultToVi = true;
      }
    } catch {
      // ignore storage errors in restricted contexts
    }
  }

  setupI18nInstance({
    supportedLngs: languages.map((l) => l.key),
  });

  if (shouldDefaultToVi) {
    setLanguage('vi-VN');
  }
}
