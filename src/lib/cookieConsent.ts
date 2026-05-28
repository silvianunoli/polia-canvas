export const COOKIE_CONSENT_KEY = "polia-cookie-consent";

export type CookieConsentValue = "accepted" | "essential" | "rejected";

export const getCookieConsent = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(COOKIE_CONSENT_KEY);
};

export const setCookieConsent = (value: CookieConsentValue) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOKIE_CONSENT_KEY, value);
  window.dispatchEvent(new Event("polia-cookie-consent-change"));
};

export const hasConsent = (type: "essential" | "analytics"): boolean => {
  const consent = getCookieConsent();
  if (type === "essential") return consent !== null;
  if (type === "analytics") return consent === "accepted";
  return false;
};
