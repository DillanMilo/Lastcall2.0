"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Send, Loader2, Bot, User, X, Sparkles, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  orgId: string;
  onClose?: () => void;
}

const SUGGESTED_QUESTIONS = [
  "What should I order?",
  "What's expiring soon?",
  "Set expiry dates",
  "Daily summary",
  "Low stock alerts",
];

// Helper to create welcome message
function getWelcomeMessage(): Message {
  return {
    role: "assistant",
    content:
      '👋 Hi! I\'m your Inventory assistant. I can help you with:\n\n📦 **Smart Ordering** - Tell you exactly what to order based on sales\n📅 **Set Expiry Dates** - Just say "Set expiry for [items] to [date]"\n⚠️ **Alerts** - Low stock and expiring items\n📊 **Reports** - Daily/weekly summaries\n\nWhat would you like to do?',
    timestamp: new Date(),
  };
}

export function AIAssistant({ orgId, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(`ai-chat-${orgId}`);
    if (savedMessages) {
      try {
        const parsed: Message[] = JSON.parse(savedMessages);
        const messagesWithDates = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        // Keep only last 10 messages (5 pairs)
        setMessages(messagesWithDates.slice(-10));
      } catch (error) {
        console.error("Error loading saved messages:", error);
        setMessages([getWelcomeMessage()]);
      }
    } else {
      setMessages([getWelcomeMessage()]);
    }
  }, [orgId]);

  // Save messages to localStorage whenever they change
  // Keep only last 12 messages (6 pairs including welcome) to limit storage
  useEffect(() => {
    if (messages.length > 0) {
      const messagesToSave = messages.slice(-12);
      localStorage.setItem(`ai-chat-${orgId}`, JSON.stringify(messagesToSave));
    }
  }, [messages, orgId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const userMessage = messageText || input.trim();
    if (!userMessage || loading) return;

    // Add user message
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setLoading(true);

    try {
      // Get last 10 messages (5 pairs of user/assistant) for context
      // Skip the initial welcome message, keep recent conversation
      const recentMessages = messages.slice(-10).filter((m) => {
        // Don't send the initial welcome message to save tokens
        return !(m.role === "assistant" && m.content.includes("👋 Hi!"));
      });

      // Send to AI API
      const response = await fetch("/api/ai/assistant", {
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

      const data: { response?: string; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Add AI response
      const aiMessage: Message = {
        role: "assistant",
        content:
          data.response ??
          "I couldn't generate a response, but your request was received.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error getting AI response:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `❌ Sorry, I encountered an error: ${message}. Please try again or check your OpenAI API key configuration.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear conversation history? This cannot be undone.")) {
      setMessages([getWelcomeMessage()]);
      localStorage.removeItem(`ai-chat-${orgId}`);
    }
  };

  return (
    <Card className="flex flex-col h-[60vh] sm:h-[500px] md:h-[600px] max-h-[400px] sm:max-h-[85vh] w-full overflow-hidden">
      <CardHeader className="border-b p-2.5 sm:p-4 md:p-6 shrink-0 bg-card z-10">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 flex-shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base md:text-lg truncate">
                AI Inventory Assistant
              </CardTitle>
              <CardDescription className="text-[10px] xs:text-xs sm:text-sm truncate">
                Ask me about your stock
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              title="Clear conversation"
              className="flex h-8 w-8"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden relative">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4 min-h-0">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 md:gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] sm:max-w-[85%] md:max-w-[80%] rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2 md:px-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {message.content}
                </p>
                <p className="text-[10px] xs:text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {message.role === "user" && (
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 md:gap-3 justify-start">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-3 py-2 md:px-4 md:py-3">
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 border-t bg-muted/30 shrink-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
              {SUGGESTED_QUESTIONS.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(question)}
                  disabled={loading}
                  className="text-[10px] sm:text-xs h-6 sm:h-7 md:h-8 px-1.5 sm:px-2 md:px-3"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input - Fixed at bottom */}
        <div className="p-3 sm:p-3 md:p-4 pb-3 sm:pb-3 md:pb-4 border-t bg-card z-20 shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your inventory..."
              disabled={loading}
              className="flex-1 text-base sm:text-sm h-10 sm:h-10 min-h-[44px]"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              size="icon"
              className="flex-shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] xs:text-xs text-muted-foreground mt-1.5 sm:mt-2 hidden sm:block">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
