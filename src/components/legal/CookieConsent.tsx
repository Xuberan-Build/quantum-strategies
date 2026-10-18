"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./CookieConsent.module.css";

const COOKIE_NAME = "qs_cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function getCookieValue(name: string) {
  const cookies = document.cookie.split("; ").map(item => item.trim());
  const match = cookies.find(cookie => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

function setConsentCookie(value: string) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    value
  )}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

function updateGoogleConsent(granted: boolean) {
  window.dataLayer = window.dataLayer || [];
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments);
  }

  gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
  });
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieValue(COOKIE_NAME);
    if (!existing) {
      setVisible(true);
    } else {
      // Apply previously saved consent to GTM
      updateGoogleConsent(existing === "accepted");
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.title}>Cookie preferences</p>
          <p className={styles.text}>
            We use essential cookies to run the site and optional analytics cookies to improve the
            experience. You can accept or reject non-essential cookies at any time.
          </p>
          <Link className={styles.link} href="/privacy/#cookies">
            Learn more in our Privacy Policy
          </Link>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => {
              setConsentCookie("rejected");
              updateGoogleConsent(false);
              setVisible(false);
            }}
          >
            Reject non-essential
          </button>
          <button
            className={styles.primary}
            type="button"
            onClick={() => {
              setConsentCookie("accepted");
              updateGoogleConsent(true);
              setVisible(false);
            }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
