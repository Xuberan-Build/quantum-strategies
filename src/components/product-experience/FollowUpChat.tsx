'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import AILoadingAnimation from './AILoadingAnimation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FollowUpChatProps {
  sessionId: string;
  stepNumber: number;
  stepData: any;
  productSlug: string;
  mainResponse: string;
  followUpCount: number;
  onFollowUpCountChange: (count: number) => void;
  onComplete: () => void;
  userId: string;
  placements: any;
}

export function FollowUpChat({
  sessionId,
  stepNumber,
  stepData,
  productSlug,
  mainResponse,
  followUpCount,
  onFollowUpCountChange,
  onComplete,
  userId,
  placements,
}: FollowUpChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const appendConversation = async (newMessages: Array<{ role: 'user' | 'assistant'; content: string; type?: string }>) => {
    const { data } = await supabase
      .from('conversations')
      .select('messages')
      .eq('session_id', sessionId)
      .eq('step_number', stepNumber)
      .maybeSingle();
    const existing = (data?.messages as any[]) || [];
    const updated = [
      ...existing,
      ...newMessages.map((m) => ({
        ...m,
        created_at: new Date().toISOString(),
      })),
    ];
    await supabase
      .from('conversations')
      .upsert(
        { session_id: sessionId, step_number: stepNumber, messages: updated },
        { onConflict: 'session_id,step_number' }
      );
  };

  const maxFollowUps = 3;
  const remainingQuestions = maxFollowUps - followUpCount;

  const suggestionMap: Record<number, string[]> = {
    2: [
      'Lead flow is inconsistent',
      'Conversion/pricing is weak',
      'Delivery/ops is bottlenecked',
      'Confidence/visibility is the block',
      'Not sure—help me diagnose',
    ],
    3: [
      'Audience growth is the priority',
      'Offer clarity/messaging is fuzzy',
      'I need a fast cash offer in 30 days',
      'Proof/case studies are missing',
      'Not sure—help me pick a path',
    ],
    4: [
      'I want a high-touch offer',
      'I want a cohort/workshop',
      'I want a productized/membership',
      'I want a recurring model',
      'Not sure—give me the best fit for my chart',
    ],
    5: [
      'I need a 30-day revenue experiment',
      'I need a content/visibility plan',
      'I need delivery/ops simplification',
      'I need a pricing/packaging reset',
      'Not sure—what should I do first?',
    ],
  };

  useEffect(() => {
    // Initialize with welcome message
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Great! You can ask up to ${maxFollowUps} follow-up questions. If you're unsure, tap a quick option or ask me to diagnose.`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || followUpCount >= maxFollowUps) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to database
      await appendConversation([{ role: 'user', content: input, type: 'followup_question' }]);

      // Get AI response
      const response = await fetch('/api/products/followup-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          stepNumber,
          stepData,
          productSlug,
                  mainResponse,
          followUpQuestion: input,
          conversationHistory: messages,
          userId,
          placements,
        }),
      });

      const { aiResponse } = await response.json();

      // Save AI response to database
      await appendConversation([{ role: 'assistant', content: aiResponse, type: 'followup_response' }]);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      onFollowUpCountChange(followUpCount + 1);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-[#F8F5FF]/10 overflow-hidden">
      {/* Header */}
      <div className="bg-white/5 border-b border-[#F8F5FF]/10 px-6 py-4">
        <h3 className="text-xl font-semibold text-[#F8F5FF]">
          Follow-Up Questions
        </h3>
        <p className="text-[#F8F5FF]/60 text-sm mt-1">
          {remainingQuestions} {remainingQuestions === 1 ? 'question' : 'questions'} remaining
        </p>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white'
                  : 'bg-white/10 text-[#F8F5FF]'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          </div>
        ))}

        {isLoading && <AILoadingAnimation variant="compact" />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#F8F5FF]/10 p-6">
        {suggestionMap[stepNumber] && followUpCount < maxFollowUps && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestionMap[stepNumber].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setInput(s);
                  setTimeout(handleSendMessage, 0);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              followUpCount >= maxFollowUps
                ? 'No more questions available'
                : 'Ask a follow-up question...'
            }
            disabled={followUpCount >= maxFollowUps || isLoading}
            className="flex-1 bg-[#F8F5FF]/5 border border-[#F8F5FF]/20 rounded-xl px-5 py-3 text-[#F8F5FF] placeholder-[#F8F5FF]/40 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || followUpCount >= maxFollowUps || isLoading}
            className="bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white font-semibold px-6 py-3 rounded-xl hover:shadow-lg hover:shadow-[#6C5CE7]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              'Send'
            )}
          </button>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-[#F8F5FF]/50 text-sm">
            Press Enter to send
          </p>
          <button
            onClick={onComplete}
            className="bg-white/10 hover:bg-white/20 text-[#F8F5FF] font-semibold px-6 py-2 rounded-lg transition-all"
          >
            Continue to Next Step →
          </button>
        </div>
      </div>
    </div>
  );
}
