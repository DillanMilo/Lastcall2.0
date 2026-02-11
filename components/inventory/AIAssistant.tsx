"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, X, Sparkles, RotateCcw, Zap, Mic, MicOff, BarChart3 } from "lucide-react";
import { checkFeatureAccess } from "@/lib/stripe/tier-limits";
import type { PlanTier } from "@/lib/stripe/config";

// Web Speech API type definitions
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIAssistantProps {
  orgId: string;
  onClose?: () => void;
  subscriptionTier?: PlanTier | 'trial';
  billingExempt?: boolean;
}

const SUGGESTED_QUESTIONS = [
  { text: "What should I order?", icon: "order" },
  { text: "Optimize reorder levels", icon: "reorder" },
  { text: "What's expiring soon?", icon: "expire" },
  { text: "Low stock alerts", icon: "alert" },
];

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

const REPORT_OPTIONS: { label: string; period: ReportPeriod }[] = [
  { label: "Daily", period: "daily" },
  { label: "Weekly", period: "weekly" },
  { label: "Monthly", period: "monthly" },
  { label: "Quarterly", period: "quarterly" },
];

// Keywords that indicate a sales report request
const REPORT_KEYWORDS = [
  'daily report', 'weekly report', 'monthly report', 'quarterly report',
  'daily sales', 'weekly sales', 'monthly sales', 'quarterly sales',
  'sales report', 'sales summary', 'performance report',
  'how did we do this week', 'how did we do this month',
  'this week sales', 'this month sales', 'today sales',
  'show me this week', 'show me this month',
  'give me a daily', 'give me a weekly', 'give me a monthly', 'give me a quarterly',
];

function detectReportPeriod(message: string): ReportPeriod | null {
  const lower = message.toLowerCase();
  if (!REPORT_KEYWORDS.some(kw => lower.includes(kw))) return null;
  if (lower.includes('quarterly') || lower.includes('quarter') || lower.includes('90 day')) return 'quarterly';
  if (lower.includes('monthly') || lower.includes('month') || lower.includes('30 day')) return 'monthly';
  if (lower.includes('weekly') || lower.includes('week') || lower.includes('7 day')) return 'weekly';
  if (lower.includes('daily') || lower.includes('today') || lower.includes('day report')) return 'daily';
  // Default to weekly if they just say "sales report" without a period
  return 'weekly';
}

// Error types for better UX
type ErrorType = 'network' | 'rate_limit' | 'server' | 'unknown';

interface ParsedError {
  type: ErrorType;
  message: string;
  action?: string;
}

function parseError(error: unknown, responseData?: Record<string, unknown>): ParsedError {
  // Check for rate limit from response
  if (responseData?.upgradeRequired) {
    return {
      type: 'rate_limit',
      message: `You've used all your AI requests this month (${responseData.currentCount}/${responseData.limit}).`,
      action: 'Upgrade your plan for more AI capabilities.',
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Unable to connect to the AI service.',
      action: 'Check your internet connection and try again.',
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return {
      type: 'server',
      message: 'The request took too long.',
      action: 'Try a shorter question or try again in a moment.',
    };
  }

  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return {
      type: 'server',
      message: 'AI service is temporarily unavailable.',
      action: 'Please try again in a few seconds.',
    };
  }

  return {
    type: 'unknown',
    message: errorMessage || 'Something went wrong.',
    action: 'Please try again.',
  };
}

function getWelcomeMessage(): Message {
  return {
    role: "assistant",
    content:
      "Hey! I'm your inventory co-pilot. I can help you with smart ordering, expiry tracking, alerts, and reports. What do you need?",
    timestamp: new Date(),
  };
}

// Typing indicator with warm pulse
function TypingIndicator({ isStreaming }: { isStreaming?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60"
            style={{
              animation: `typing-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-2 opacity-70">
        {isStreaming ? "responding..." : "thinking..."}
      </span>
    </div>
  );
}

// Streaming cursor for real-time response feel
function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 bg-primary/60 ml-0.5 animate-pulse" />
  );
}

// Message bubble with distinctive styling
function MessageBubble({ message, isLatest }: { message: Message; isLatest: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming && message.content.length > 0;
  const isWaiting = message.isStreaming && message.content.length === 0;

  // Don't render empty streaming messages as bubbles
  if (isWaiting) {
    return null;
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} ${
        isLatest && !isStreaming ? "animate-message-in" : ""
      }`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="relative flex-shrink-0">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/10 shadow-sm ${isStreaming ? 'animate-pulse' : ''}`}>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          {/* Subtle glow */}
          <div className="absolute inset-0 rounded-xl bg-primary/10 blur-md -z-10 opacity-50" />
        </div>
      )}

      {/* Message Content */}
      <div
        className={`relative max-w-[80%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-md"
            : "bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-bl-md shadow-sm"
        }`}
      >
        {/* Decorative corner for AI messages */}
        {!isUser && (
          <div className="absolute -left-px top-3 w-0.5 h-6 bg-gradient-to-b from-primary/50 to-transparent rounded-full" />
        )}

        <div className="px-4 py-3">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
            {isStreaming && <StreamingCursor />}
          </p>
        </div>

        {/* Timestamp - only show when not streaming */}
        {!isStreaming && (
          <div
            className={`px-4 pb-2 ${
              isUser ? "text-primary-foreground/60" : "text-muted-foreground/60"
            }`}
          >
            <span className="text-[10px] font-mono">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-primary-foreground font-semibold text-sm">You</span>
        </div>
      )}
    </div>
  );
}

export function AIAssistant({ orgId, onClose, subscriptionTier, billingExempt }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [mobileQuickActions, setMobileQuickActions] = useState(false);
  const [mobileReportActions, setMobileReportActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check if voice input is available for this tier (Starter+)
  // Treat 'trial' as 'free' for feature access
  const effectiveTier: PlanTier = subscriptionTier === 'trial' ? 'free' : (subscriptionTier || 'free');
  const voiceInputAccess = checkFeatureAccess(
    effectiveTier,
    'voice_input',
    billingExempt
  );
  const canUseVoiceInput = voiceInputAccess.allowed;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const savedMessages = localStorage.getItem(`ai-chat-${orgId}`);
    if (savedMessages) {
      try {
        const parsed: Message[] = JSON.parse(savedMessages);
        const messagesWithDates = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          isStreaming: false, // Ensure no streaming state persists
        }));
        // Increased from 10 to 20 for better context
        setMessages(messagesWithDates.slice(-20));
      } catch {
        setMessages([getWelcomeMessage()]);
      }
    } else {
      setMessages([getWelcomeMessage()]);
    }
  }, [orgId]);

  useEffect(() => {
    if (messages.length > 0) {
      // Only save non-streaming messages, and save more (24 instead of 12)
      const messagesToSave = messages
        .filter(m => !m.isStreaming)
        .slice(-24);
      localStorage.setItem(`ai-chat-${orgId}`, JSON.stringify(messagesToSave));
    }
  }, [messages, orgId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInput(transcript);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput(''); // Clear input when starting new dictation
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const generateReport = useCallback(async (period: ReportPeriod) => {
    if (loading) return;

    const periodLabels: Record<ReportPeriod, string> = {
      daily: 'daily',
      weekly: 'weekly',
      monthly: 'monthly',
      quarterly: 'quarterly',
    };

    const userMessage: Message = {
      role: "user",
      content: `Generate a ${periodLabels[period]} sales report`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setShowReportOptions(false);

    // Create placeholder for response
    const streamingMessage: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      const response = await fetch("/api/ai/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, period }),
      });

      const data = await response.json();

      if (!response.ok) {
        const parsed = parseError(new Error(data.error || 'Request failed'), data);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.isStreaming) {
            updated[lastIndex] = {
              role: "assistant",
              content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
              timestamp: new Date(),
              isStreaming: false,
            };
          }
          return updated;
        });
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.isStreaming) {
          updated[lastIndex] = {
            role: "assistant",
            content: data.report || "Unable to generate report. Please try again.",
            timestamp: new Date(),
            isStreaming: false,
          };
        }
        return updated;
      });
    } catch (error) {
      console.error("Error generating report:", error);
      const parsed = parseError(error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.isStreaming) {
          updated[lastIndex] = {
            role: "assistant",
            content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
            timestamp: new Date(),
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, orgId]);

  const handleSend = useCallback(async (messageText?: string) => {
    const userMessage = messageText || input.trim();
    if (!userMessage || loading) return;

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");

    // Check if this is a report request - route to report endpoint
    const detectedPeriod = detectReportPeriod(userMessage);
    if (detectedPeriod) {
      setLoading(true);
      // Create placeholder for response
      const reportPlaceholder: Message = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, reportPlaceholder]);

      try {
        const response = await fetch("/api/ai/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, period: detectedPeriod }),
        });

        const data = await response.json();

        if (!response.ok) {
          const parsed = parseError(new Error(data.error || 'Request failed'), data);
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (updated[lastIndex]?.isStreaming) {
              updated[lastIndex] = {
                role: "assistant",
                content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
                timestamp: new Date(),
                isStreaming: false,
              };
            }
            return updated;
          });
          return;
        }

        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.isStreaming) {
            updated[lastIndex] = {
              role: "assistant",
              content: data.report || "Unable to generate report. Please try again.",
              timestamp: new Date(),
              isStreaming: false,
            };
          }
          return updated;
        });
        return;
      } catch (error) {
        console.error("Error generating report:", error);
        const parsed = parseError(error);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.isStreaming) {
            updated[lastIndex] = {
              role: "assistant",
              content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
              timestamp: new Date(),
              isStreaming: false,
            };
          }
          return updated;
        });
        return;
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);

    // Create placeholder for streaming response
    const streamingMessage: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      // Get recent messages for context (increased from 10 to 20)
      const recentMessages = messages.slice(-20).filter((m) => {
        return !(m.role === "assistant" && m.content.includes("Hey! I'm your"));
      });

      const response = await fetch("/api/ai/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          orgId,
          conversationHistory: recentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      // Check for non-streaming error responses (rate limit, etc.)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();

        if (!response.ok) {
          const parsed = parseError(new Error(data.error || 'Request failed'), data);
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (updated[lastIndex]?.isStreaming) {
              updated[lastIndex] = {
                role: "assistant",
                content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
                timestamp: new Date(),
                isStreaming: false,
              };
            }
            return updated;
          });
          return;
        }

        // Non-streaming response (for actions)
        if (data.response) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (updated[lastIndex]?.isStreaming) {
              updated[lastIndex] = {
                role: "assistant",
                content: data.response,
                timestamp: new Date(),
                isStreaming: false,
              };
            }
            return updated;
          });
          return;
        }
      }

      // Handle streaming response
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.content) {
                fullContent += data.content;
                // Update the streaming message with new content
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (updated[lastIndex]?.isStreaming) {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: fullContent,
                    };
                  }
                  return updated;
                });
              }

              if (data.done) {
                // Finalize the message
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (updated[lastIndex]?.isStreaming) {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      isStreaming: false,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }

      // Ensure streaming flag is removed
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.isStreaming) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            isStreaming: false,
            content: fullContent || "I couldn't generate a response. Please try again.",
          };
        }
        return updated;
      });

    } catch (error) {
      console.error("Error getting AI response:", error);
      const parsed = parseError(error);

      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.isStreaming) {
          updated[lastIndex] = {
            role: "assistant",
            content: `⚠️ **${parsed.message}**${parsed.action ? `\n\n${parsed.action}` : ''}`,
            timestamp: new Date(),
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, orgId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear conversation history?")) {
      setMessages([getWelcomeMessage()]);
      localStorage.removeItem(`ai-chat-${orgId}`);
    }
  };

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Ambient background effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-4 border-b bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Animated AI icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-xl bg-primary/30 animate-ping-slow opacity-75" />
          </div>
          <div>
            <h2 className="font-semibold text-base tracking-tight">Inventory AI</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearHistory}
            title="Clear history"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 min-h-0">
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            isLatest={index === messages.length - 1}
          />
        ))}

        {/* Show typing indicator when waiting for first chunk */}
        {loading && messages[messages.length - 1]?.isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3 justify-start animate-message-in">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/10">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
            </div>
            <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-bl-md shadow-sm">
              <TypingIndicator isStreaming={false} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ===== DESKTOP: Quick Actions (hidden on mobile) ===== */}
      {showSuggestions && (
        <div className="relative px-5 py-4 border-t border-border/50 bg-muted/30 backdrop-blur-sm hidden sm:block">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, index) => (
              <button
                key={index}
                onClick={() => handleSend(q.text)}
                disabled={loading}
                className="group relative px-4 py-2 text-sm font-medium rounded-full border border-border/50 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 hover:shadow-md hover:shadow-primary/10 disabled:opacity-50 disabled:pointer-events-none"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="relative z-10">{q.text}</span>
              </button>
            ))}
          </div>

          {/* Sales Reports Section */}
          <p className="text-xs font-medium text-muted-foreground mb-3 mt-4 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" />
            Sales Reports
          </p>
          <div className="flex flex-wrap gap-2">
            {REPORT_OPTIONS.map((opt, index) => (
              <button
                key={opt.period}
                onClick={() => generateReport(opt.period)}
                disabled={loading}
                className="group relative px-4 py-2 text-sm font-medium rounded-full border border-border/50 bg-card/50 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/10 disabled:opacity-50 disabled:pointer-events-none"
                style={{ animationDelay: `${(index + SUGGESTED_QUESTIONS.length) * 50}ms` }}
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== DESKTOP: Floating Report Bar (hidden on mobile) ===== */}
      {!showSuggestions && !loading && (
        <div className="relative px-5 py-2 border-t border-border/30 bg-muted/20 backdrop-blur-sm hidden sm:block">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportOptions(!showReportOptions)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border/50 bg-card/50 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-200"
            >
              <BarChart3 className="h-3 w-3" />
              Sales Reports
            </button>
            {showReportOptions && (
              <div className="flex gap-1.5 animate-message-in">
                {REPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.period}
                    onClick={() => generateReport(opt.period)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MOBILE: Expanded panels (above input, shown on toggle) ===== */}
      {mobileQuickActions && (
        <div className="relative px-4 py-3 border-t border-amber-200/30 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 backdrop-blur-sm sm:hidden animate-message-in">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Quick Actions
            </p>
            <button onClick={() => setMobileQuickActions(false)} className="p-1 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-800/30 transition-colors">
              <X className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q, index) => (
              <button
                key={index}
                onClick={() => { handleSend(q.text); setMobileQuickActions(false); }}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all duration-200 disabled:opacity-50"
              >
                {q.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {mobileReportActions && (
        <div className="relative px-4 py-3 border-t border-emerald-200/30 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-sm sm:hidden animate-message-in">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" />
              Sales Reports
            </p>
            <button onClick={() => setMobileReportActions(false)} className="p-1 rounded-full hover:bg-emerald-200/50 dark:hover:bg-emerald-800/30 transition-colors">
              <X className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_OPTIONS.map((opt) => (
              <button
                key={opt.period}
                onClick={() => { generateReport(opt.period); setMobileReportActions(false); }}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-200 disabled:opacity-50"
              >
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative p-4 border-t border-border/50 bg-card/80 backdrop-blur-md safe-bottom">
        {/* Mobile toggle buttons - only visible on small screens */}
        <div className="flex gap-2 mb-2.5 sm:hidden">
          <button
            onClick={() => { setMobileQuickActions(!mobileQuickActions); setMobileReportActions(false); }}
            disabled={loading}
            className={`mobile-glow-gold relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full transition-all duration-300 disabled:opacity-50 ${
              mobileQuickActions
                ? 'bg-amber-500 text-white border border-amber-400 shadow-lg shadow-amber-500/30'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Quick Actions
          </button>
          <button
            onClick={() => { setMobileReportActions(!mobileReportActions); setMobileQuickActions(false); }}
            disabled={loading}
            className={`mobile-glow-green relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full transition-all duration-300 disabled:opacity-50 ${
              mobileReportActions
                ? 'bg-emerald-500 text-white border border-emerald-400 shadow-lg shadow-emerald-500/30'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Sales Reports
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Ask about your inventory..."}
              disabled={loading || isListening}
              className={`w-full h-12 pl-4 pr-4 text-base rounded-xl bg-muted/50 border-border/50 focus-visible:ring-primary/50 focus-visible:border-primary/50 placeholder:text-muted-foreground/50 ${isListening ? 'border-red-500/50 bg-red-500/5' : ''}`}
            />
          </div>
          {/* Microphone Button - Starter+ only */}
          {canUseVoiceInput && (
            <Button
              onClick={toggleListening}
              disabled={loading}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className={`flex-shrink-0 h-12 w-12 rounded-xl transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse-recording'
                  : 'hover:bg-muted/80 hover:border-primary/50'
              }`}
              title={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
          {/* Send Button */}
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            size="icon"
            className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="hidden sm:block text-[10px] text-muted-foreground/50 text-center mt-2">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[9px]">Enter</kbd> to send
        </p>
      </div>

      {/* Custom styles */}
      <style jsx>{`
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        @keyframes message-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.75;
          }
          75%, 100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        .animate-message-in {
          animation: message-in 0.3s ease-out forwards;
        }

        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes pulse-recording {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }

        .animate-pulse-recording {
          animation: pulse-recording 1.5s ease-in-out infinite;
        }

        /* Mobile glow animations - soft pulsating */
        @keyframes glow-gold {
          0%, 100% {
            box-shadow: 0 0 4px 0 rgba(245, 158, 11, 0.2), 0 0 12px 0 rgba(245, 158, 11, 0.1);
          }
          50% {
            box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.35), 0 0 20px 4px rgba(245, 158, 11, 0.15);
          }
        }

        @keyframes glow-green {
          0%, 100% {
            box-shadow: 0 0 4px 0 rgba(16, 185, 129, 0.2), 0 0 12px 0 rgba(16, 185, 129, 0.1);
          }
          50% {
            box-shadow: 0 0 8px 2px rgba(16, 185, 129, 0.35), 0 0 20px 4px rgba(16, 185, 129, 0.15);
          }
        }

        @media (max-width: 639px) {
          .mobile-glow-gold {
            animation: glow-gold 2.5s ease-in-out infinite;
          }
          .mobile-glow-green {
            animation: glow-green 2.5s ease-in-out infinite;
          }
        }
      `}</style>
    </div>
  );
}
