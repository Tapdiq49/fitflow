import { loadLang } from './app/core/i18n/translate';

// English and Russian are loaded on demand in the app; the specs switch language freely, so they have them from the start.
beforeAll(async () => {
  await loadLang('en');
  await loadLang('ru');
});
