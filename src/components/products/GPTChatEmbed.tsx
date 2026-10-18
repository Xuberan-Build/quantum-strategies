"use client";
import { useEffect, useState } from "react";
import styles from "./gpt-chat-embed.module.css";

interface GPTChatEmbedProps {
  iframeUrl: string;
  productSlug: string;
}

export default function GPTChatEmbed({ iframeUrl, productSlug }: GPTChatEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPayment, setHasPayment] = useState(false);

  useEffect(() => {
    // Verify payment via URL parameter
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    setHasPayment(!!sessionId);

    if (sessionId) {
      localStorage.setItem(`payment_${productSlug}`, JSON.stringify({
        sessionId,
        timestamp: Date.now(),
      }));
    }
  }, [productSlug]);

  if (!hasPayment) {
    return (
      <div className={styles.container}>
        <div className={styles.warning}>
          <h2>Payment Verification Required</h2>
          <p>Please complete your purchase to access this GPT.</p>
          <a href={`/products/${productSlug}/#purchase`}>Return to Product Page</a>
        </div>
      </div>
    );
  }

  if (!iframeUrl) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <h2>GPT Configuration Pending</h2>
          <p>You'll receive access via email shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your AI strategist...</p>
        </div>
      )}

      <iframe
        src={iframeUrl}
        className={styles.iframe}
        title="GPT Chat Interface"
        onLoad={() => setIsLoading(false)}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allow="clipboard-write"
      />
    </div>
  );
}
