import { getRequestConfig } from 'next-intl/server';

// Phase 2 ships English only. Future locales will wire a locale resolver
// (cookie + Accept-Language) here without touching the rest of the app.
export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
