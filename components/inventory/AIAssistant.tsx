"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="flex flex-col h-full w-full bg-background sm:rounded-xl overflow-hidden shadow-2xl">
      {/* Header - Clean and spacious */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-base sm:text-lg">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask about your inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearHistory}
            title="Clear conversation"
            className="h-9 w-9 rounded-xl hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0 bg-muted/20">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border shadow-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </p>
              <p className={`text-[10px] mt-2 ${
                message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {message.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-card border shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length === 1 && (
        <div className="px-4 py-3 border-t bg-card/50">
          <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSend(question)}
                disabled={loading}
                className="text-xs h-8 px-3 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - Clean and modern */}
      <div className="p-4 border-t bg-card safe-bottom">
        <div className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 text-base sm:text-sm h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            size="icon"
            className="flex-shrink-0 h-11 w-11 rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
