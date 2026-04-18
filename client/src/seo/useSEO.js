/**
 * useSEO — Lightweight hook to set per-page title & meta description
 * without an extra runtime library. Works with Vite + React Router.
 */
import { useEffect } from "react";

const SITE_NAME = "SalesAdmin | ScanServices";
const DEFAULT_DESCRIPTION =
  "SalesAdmin by ScanServices — Professional field sales tracking, GPS attendance management, and real-time team monitoring platform for Indian businesses.";

/**
 * @param {Object} opts
 * @param {string} opts.title  - Page-specific title (will be appended with " | SalesAdmin")
 * @param {string} opts.description - Custom meta description for this page
 * @param {string} [opts.canonicalPath] - Canonical path e.g. "/login"
 */
const useSEO = ({ title, description, canonicalPath }) => {
  useEffect(() => {
    const BASE_URL = "https://ss.scanservices.in";

    // ── Title ──────────────────────────────────────────
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    // ── Description ────────────────────────────────────
    const desc = description || DEFAULT_DESCRIPTION;
    setMeta("name", "description", desc);

    // ── Open Graph ─────────────────────────────────────
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "SalesAdmin");
    setMeta("property", "og:locale", "en_IN");
    if (canonicalPath) {
      setMeta("property", "og:url", `${BASE_URL}${canonicalPath}`);
      setCanonical(`${BASE_URL}${canonicalPath}`);
    }

    // ── Twitter Card ───────────────────────────────────
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);

    return () => {
      // Reset to default on unmount
      document.title = SITE_NAME;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonicalPath]);
};

/** Helper to upsert a <meta> tag */
function setMeta(attrKey, attrValue, content) {
  let el = document.querySelector(`meta[${attrKey}="${attrValue}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrKey, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Helper to upsert <link rel="canonical"> */
function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export default useSEO;
