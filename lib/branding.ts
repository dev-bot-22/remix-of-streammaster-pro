// lib/branding.ts — single source of truth for app name + Telegram links.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO";
export const TELEGRAM_USERNAME = (
  process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "official_marco_22"
).replace(/^@/, "");
export const TELEGRAM_LINK =
  process.env.NEXT_PUBLIC_TELEGRAM_LINK || `https://t.me/${TELEGRAM_USERNAME}`;
export const TELEGRAM_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || TELEGRAM_USERNAME;
/** Permanent PW-MARCO identity used everywhere; saved legacy logos cannot override it. */
export const BRAND_LOGO = "/pw-marco-logo-2026.png?v=pw-marco-2026c";
/** Banner shown for any batch that has no image of its own. */
export const DEFAULT_BATCH_BANNER =
  process.env.NEXT_PUBLIC_DEFAULT_BATCH_BANNER ||
  "https://i.ibb.co/YT0v1Fcc/file-000000008d1c8211a64b48d531d3d091.png";
