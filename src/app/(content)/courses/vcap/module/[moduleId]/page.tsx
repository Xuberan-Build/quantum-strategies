import { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import ProgressBar from "@/components/courses/ProgressBar";
import styles from "./module.module.css";

interface ModulePageProps {
  params: Promise<{
    moduleId: string;
  }>;
}

// Load module data
function getModuleData(moduleId: string) {
  try {
    const modulePath = path.join(
      process.cwd(),
      `src/content/courses/vcap/modules/${moduleId}/module.json`
    );
    return JSON.parse(fs.readFileSync(modulePath, "utf-8"));
  } catch {
    return null;
  }
}

function getCourseData() {
  const coursePath = path.join(
    process.cwd(),
    "src/content/courses/vcap/course.json"
  );
  return JSON.parse(fs.readFileSync(coursePath, "utf-8"));
}

export async function generateStaticParams() {
  const course = getCourseData();
  return course.modules.map((module: any) => ({
    moduleId: module.id,
  }));
}

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { moduleId } = await params;
  const module = getModuleData(moduleId);

  if (!module) {
    return {
      title: "Module Not Found",
    };
  }

  return {
    title: `${module.title} - VCAP - Quantum Strategies`,
    description: module.description,
    alternates: {
      canonical: `https://quantumstrategies.online/courses/vcap/module/${moduleId}/`,
    },
  };
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleId } = await params;
  const module = getModuleData(moduleId);
  const course = getCourseData();

  if (!module) {
    notFound();
  }

  // Calculate stats
  const totalLessons = module.lessons.length;
  const completedLessons = 0; // TODO: Get from user progress in Supabase
  const totalSlides = module.lessons
    .filter((l: any) => l.type === "slides")
    .reduce((sum: number, l: any) => sum + (l.slideCount || 0), 0);
  const estimatedMinutes = module.lessons.reduce(
    (sum: number, l: any) => sum + (l.duration || 0),
    0
  );

  // Get lesson type icons and labels
  const getLessonIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      text: "📄",
      slides: "🎯",
      video: "🎥",
      workbook: "✍️",
    };
    return icons[type] || "📖";
  };

  const getLessonTypeLabel = (lesson: any) => {
    if (lesson.type === "slides") return `${lesson.slideCount} slides`;
    if (lesson.type === "video") return `${lesson.duration} min`;
    if (lesson.type === "text") return `${lesson.duration} min`;
    return "Interactive";
  };

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/courses/">Courses</Link>
        <span className={styles.separator}>→</span>
        <Link href="/courses/vcap/">VCAP</Link>
        <span className={styles.separator}>→</span>
        <span>Module {module.number}</span>
      </div>

      {/* Module Hero */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div
            className={styles.iconWrapper}
            style={{ backgroundColor: module.color }}
          >
            <span className={styles.icon}>{module.icon}</span>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.moduleLabel}>Module {module.number}</div>
            <h1 className={styles.heroTitle}>{module.title}</h1>
            <p className={styles.heroSubtitle}>{module.subtitle}</p>
            <p className={styles.portalNote}>
              Portal access required. You will be redirected to sign in or create an account.
            </p>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statIcon}>📚</span>
                <span className={styles.statValue}>{totalLessons}</span>
                <span className={styles.statLabel}>Lessons</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statIcon}>🎯</span>
                <span className={styles.statValue}>{totalSlides}</span>
                <span className={styles.statLabel}>Slides</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statIcon}>⏱️</span>
                <span className={styles.statValue}>{estimatedMinutes}</span>
                <span className={styles.statLabel}>Minutes</span>
              </div>
            </div>

            {completedLessons > 0 && (
              <div className={styles.progressWrapper}>
                <ProgressBar
                  current={completedLessons}
                  total={totalLessons}
                  label="Progress"
                  color={module.color}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Module Overview */}
      <section className={styles.overviewSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You'll Learn</h2>
          <p className={styles.description}>{module.description}</p>

          <div className={styles.highlights}>
            <h3 className={styles.highlightsTitle}>Key Components:</h3>
            <ul className={styles.highlightsList}>
              {module.highlights.map((highlight: string, idx: number) => (
                <li key={idx}>{highlight}</li>
              ))}
            </ul>
          </div>

          <div className={styles.outcome}>
            <strong>Module Outcome:</strong> {module.outcome}
          </div>
        </div>
      </section>

      {/* Lesson Navigator */}
      <section className={styles.lessonsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Lessons in This Module</h2>

          <div className={styles.lessonsList}>
            {module.lessons.map((lesson: any, idx: number) => {
              const isLocked = false; // TODO: Check enrollment/progress
              const isCompleted = false; // TODO: Check from Supabase

              // Determine the href based on lesson type
              let lessonHref = "#";
              lessonHref = `/login?redirect=/dashboard/courses/vcap/module/${moduleId}`;

              return (
                <Link
                  key={lesson.id}
                  href={isLocked ? "#" : lessonHref}
                  className={`${styles.lessonCard} ${isLocked ? styles.locked : ""} ${
                    isCompleted ? styles.completed : ""
                  }`}
                >
                  <div className={styles.lessonNumber}>{idx + 1}</div>

                  <div className={styles.lessonIcon}>{getLessonIcon(lesson.type)}</div>

                  <div className={styles.lessonContent}>
                    <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                    <p className={styles.lessonMeta}>
                      {lesson.type.charAt(0).toUpperCase() + lesson.type.slice(1)} •{" "}
                      {getLessonTypeLabel(lesson)}
                    </p>
                  </div>

                  <div className={styles.lessonAction}>
                    {isLocked ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : isCompleted ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className={styles.nextStepsSection}>
        <div className={styles.container}>
          <div className={styles.nextStepsCard}>
            <h2 className={styles.nextStepsTitle}>Ready to Begin?</h2>
            <p className={styles.nextStepsDescription}>
              Start with the first lesson and work through the module at your own pace.
            </p>
            <div className={styles.nextStepsButtons}>
              {module.lessons[0] && (
                <Link
                  href={`/login?redirect=/dashboard/courses/vcap/module/${moduleId}`}
                  className={styles.startButton}
                >
                  Access Module in Portal →
                </Link>
              )}
              <Link href="/courses/vcap/" className={styles.backButton}>
                ← Back to Course Overview
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
