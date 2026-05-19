'use client';

import { ProductInstructions } from '@/lib/product-definitions/types';

interface WelcomeBannerProps {
  instructions: ProductInstructions;
  onBegin: () => void;
}

export function WelcomeBanner({ instructions, onBegin }: WelcomeBannerProps) {
  const { welcome } = instructions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl">
        {/* Glassmorphic Card */}
        <div
          className="relative overflow-hidden rounded-3xl border border-purple-300/20 bg-gradient-to-br from-purple-900/30 via-indigo-900/25 to-purple-800/30 p-6 sm:p-10 md:p-12 shadow-2xl backdrop-blur-xl"
        >
          {/* Gradient Accent Line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/50 to-transparent" />

          {/* Content */}
          <div className="relative space-y-8">
            {/* Title */}
            <h1 className="bg-gradient-to-br from-white via-purple-100 to-purple-200 bg-clip-text text-center text-2xl sm:text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              {welcome.title}
            </h1>

            {/* Description */}
            <div className="space-y-4 text-center">
              {welcome.description.split('\n\n').map((paragraph, idx) => (
                <p
                  key={idx}
                  className="text-lg leading-relaxed text-purple-100/90"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Estimated Time Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-950/40 px-5 py-2.5 backdrop-blur-sm">
                <svg
                  className="h-5 w-5 text-teal-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-semibold text-teal-200">
                  {welcome.estimatedTime}
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={onBegin}
                className="group relative overflow-hidden rounded-xl border border-purple-300/30 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-900/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-800/60"
              >
                {/* Button Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <span className="relative flex items-center gap-2">
                  {welcome.ctaText}
                  <svg
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </button>
            </div>
          </div>

          {/* Background Decoration */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
      </div>
    </div>
  );
}
