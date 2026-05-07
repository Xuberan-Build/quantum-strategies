"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./slides.module.css";

export default function SlideViewer() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params?.moduleId as string;

  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(48);

  // Map moduleId to slideshow URLs
  // For now, we'll use placeholder URLs. Later these will point to deployed slideshows
  const slideshowUrls: { [key: string]: string } = {
    module1: "https://vcap-module-1-slides.netlify.app/", // TODO: Update with actual URL
    module2: "#", // Placeholder for module 2
    module3: "#", // Placeholder for module 3
  };

  const slideshowUrl = slideshowUrls[moduleId] || "#";

  useEffect(() => {
    // Listen for postMessage from iframe
    const handleMessage = (event: MessageEvent) => {
      // TODO: Verify event.origin matches slideshow domain for security
      if (event.data.type === "slideChange") {
        setCurrentSlide(event.data.currentSlide);
        setTotalSlides(event.data.totalSlides);

      }

      if (event.data.type === "slideshowComplete") {
        // TODO: Mark module slideshow as complete in Supabase
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [moduleId]);

  const handleExit = () => {
    router.push(`/courses/vcap/module/${moduleId}`);
  };

  if (slideshowUrl === "#") {
    return (
      <div className={styles.page}>
        <div className={styles.placeholder}>
          <h1>Slideshow Coming Soon</h1>
          <p>Module {moduleId} slideshow is currently being prepared.</p>
          <button onClick={handleExit} className={styles.exitButton}>
            ← Back to Module
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Minimal Header */}
      <header className={styles.header}>
        <button onClick={handleExit} className={styles.exitButton} aria-label="Exit slideshow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Exit
        </button>

        <div className={styles.headerInfo}>
          <span className={styles.moduleTitle}>Module {moduleId.replace("module", "")}</span>
          <span className={styles.progress}>
            {currentSlide} / {totalSlides}
          </span>
        </div>

        <div className={styles.spacer} />
      </header>

      {/* Slideshow Iframe */}
      <div className={styles.slideshowContainer}>
        <iframe
          src={slideshowUrl}
          className={styles.iframe}
          title={`Module ${moduleId} Slideshow`}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}
