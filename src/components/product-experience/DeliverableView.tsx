'use client';

import { ReactNode, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProductInstructions } from '@/lib/product-definitions/types';

interface DeliverableViewProps {
  deliverable: string;
  productName: string;
  instructions?: ProductInstructions;
  actionableNudges?: string[];
  feedback?: ReactNode;
}

interface Section {
  number: string;
  title: string;
  content: string;
}

export function DeliverableView({ deliverable, productName, instructions, actionableNudges, feedback }: DeliverableViewProps) {
  const [copied, setCopied] = useState(false);

  // Parse deliverable into sections
  const sections = useMemo(() => {
    const parsed: Section[] = [];
    const lines = deliverable.split('\n');
    let currentSection: Section | null = null;
    let sectionCounter = 0;

    for (const line of lines) {
      // Match various header patterns:
      // "**OPENING: Title (subtitle)**" - special case without number
      // "**SECTION 1: Title**" or "## 1. Title" or "**1. Title**" etc.
      const openingMatch = line.match(/^\*\*OPENING:\s*([^*]+?)\*\*$/i);
      const sectionMatch = line.match(/^(?:#{1,3}\s*)?(?:\*\*)?(?:SECTION\s+)?(\d+)[.):\s]+([^*\n]+?)(?:\*\*)?$/i);

      if (openingMatch) {
        // Save previous section
        if (currentSection) {
          parsed.push(currentSection);
        }
        // Opening section (no number)
        sectionCounter++;
        const cleanTitle = openingMatch[1].trim().replace(/[*#()]/g, '');
        currentSection = {
          number: '✦',
          title: cleanTitle,
          content: ''
        };
      } else if (sectionMatch) {
        // Save previous section
        if (currentSection) {
          parsed.push(currentSection);
        }
        // Numbered section
        sectionCounter++;
        const cleanTitle = sectionMatch[2].trim().replace(/[*#()]/g, '');
        currentSection = {
          number: sectionMatch[1],
          title: cleanTitle,
          content: ''
        };
      } else if (currentSection) {
        // Skip the line if it's just a header marker without our number pattern
        if (!line.trim().match(/^#{1,3}\s*$/)) {
          // Add content to current section (preserve empty lines for spacing)
          currentSection.content += line + '\n';
        }
      } else if (line.trim()) {
        // Content before first section (shouldn't happen but handle gracefully)
        if (!currentSection) {
          sectionCounter++;
          currentSection = {
            number: '✦',
            title: 'Introduction',
            content: line + '\n'
          };
        }
      }
    }

    // Add last section
    if (currentSection) {
      parsed.push(currentSection);
    }

    return parsed;
  }, [deliverable]);

  const handleCopy = () => {
    navigator.clipboard.writeText(deliverable);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let y = 20;

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(productName, margin, y);
    y += 15;

    // Process deliverable content
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lines = deliverable.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        y += 4;
        continue;
      }

      // Check for headers (##, **, or numbered)
      if (trimmedLine.match(/^#{1,3}\s+/) || trimmedLine.match(/^\*\*\d+\./)) {
        y += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        const cleanHeader = trimmedLine.replace(/^#{1,3}\s+|\*\*/g, '');
        const headerLines = pdf.splitTextToSize(cleanHeader, maxWidth);
        pdf.text(headerLines, margin, y);
        y += headerLines.length * 7;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        continue;
      }

      // Check for bold text
      let text = trimmedLine;
      let isBold = false;
      if (text.includes('**')) {
        text = text.replace(/\*\*/g, '');
        isBold = true;
      }

      // Set font based on formatting
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');

      // Split long lines
      const wrappedLines = pdf.splitTextToSize(text, maxWidth);

      // Add new page if needed
      if (y + (wrappedLines.length * 6) > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(wrappedLines, margin, y);
      y += wrappedLines.length * 6;
    }

    // Save PDF
    pdf.save(`${productName.replace(/\s+/g, '-').toLowerCase()}-blueprint.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] rounded-full mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {instructions?.deliverable ? (
            <>
              <h1 className="text-4xl font-bold text-[#F8F5FF] mb-4">
                {instructions.deliverable.title}
              </h1>
              <div className="text-[#F8F5FF]/70 text-lg space-y-2">
                {instructions.deliverable.description.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-[#F8F5FF] mb-4">
                Your Blueprint is Ready!
              </h1>
              <p className="text-[#F8F5FF]/70 text-lg">
                Congratulations on completing {productName}
              </p>
            </>
          )}
        </div>

        {/* Deliverable Card */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-[#F8F5FF]/10 overflow-hidden">
          {/* Action Buttons */}
          <div className="bg-white/5 border-b border-[#F8F5FF]/10 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#F8F5FF]">
              {productName === 'Personal Alignment Orientation' ? 'Your Personal Alignment Blueprint' : 'Your Quantum Blueprint'}
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={handleCopy}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-[#F8F5FF] font-medium px-4 py-2 rounded-lg transition-all"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white font-semibold px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-[#6C5CE7]/50 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Deliverable Content */}
          <div className="p-8 space-y-6">
            {sections.length > 0 ? (
              sections.map((section, index) => (
                <div
                  key={index}
                  className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-[#6C5CE7]/50 transition-all duration-300"
                >
                  {/* Section Number Badge */}
                  <div className="absolute -top-3 -left-3 w-12 h-12 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] rounded-full flex items-center justify-center shadow-lg shadow-[#6C5CE7]/30">
                    <span className="text-white font-bold text-lg">{section.number}</span>
                  </div>

                  {/* Section Title */}
                  <h3 className="text-2xl font-bold text-[#F8F5FF] mb-4 pl-10">
                    {section.title}
                  </h3>

                  {/* Section Content */}
                  <div className="prose prose-invert prose-sm max-w-none [&_strong]:text-[#F8F5FF] [&_strong]:font-semibold [&_p]:text-[#F8F5FF]/90 [&_p]:leading-relaxed [&_li]:text-[#F8F5FF]/90 [&_h3]:text-[#F8F5FF] [&_h4]:text-[#F8F5FF] [&_ul>li]:marker:text-[#6C5CE7] [&_ol>li]:marker:text-[#6C5CE7] [&_ol>li]:marker:font-semibold [&_li>p]:my-0 [&_li>p]:inline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {section.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            ) : (
              // Fallback if parsing fails
              <div className="text-[#F8F5FF] whitespace-pre-wrap leading-relaxed">
                {deliverable}
              </div>
            )}

            {/* Actionable Nudges Bonus Section */}
            {actionableNudges && actionableNudges.length > 0 && (
              <div className="mt-8 pt-8 border-t border-[#F8F5FF]/20">
                <div className="bg-gradient-to-br from-[#6C5CE7]/20 to-[#A29BFE]/10 backdrop-blur-sm rounded-xl border border-[#6C5CE7]/30 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-[#F8F5FF]">
                      Actionable Nudges
                    </h3>
                  </div>
                  <p className="text-[#F8F5FF]/70 mb-6">
                    Key insights and next steps from your journey:
                  </p>
                  <div className="prose prose-invert prose-sm max-w-none [&_strong]:text-[#F8F5FF] [&_strong]:font-semibold [&_p]:text-[#F8F5FF]/90 [&_p]:leading-relaxed [&_ul>li]:marker:text-[#6C5CE7] [&_ol>li]:marker:text-[#6C5CE7] [&_li>p]:my-0 [&_li>p]:inline">
                    <ul>
                      {actionableNudges.map((nudge, index) => (
                        <li key={index}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{ p: ({ children }) => <span>{children}</span> }}
                          >
                            {nudge.trim()}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {feedback && (
          <div className="mt-12">
            {feedback}
          </div>
        )}

        {/* Next Steps */}
        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center space-x-2 text-[#F8F5FF]/70 hover:text-[#F8F5FF] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Return to Dashboard</span>
          </a>
        </div>
      </div>
    </div>
  );
}
