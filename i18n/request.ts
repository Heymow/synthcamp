import { getRequestConfig } from 'next-intl/server';

// SynthCamp ships English only by design (see feedback_language.md). The
// next-intl plumbing is kept to centralize copy and pluralization, not to
// support multiple locales.
export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
