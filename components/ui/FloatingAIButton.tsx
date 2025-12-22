"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AIAssistant } from "@/components/inventory/AIAssistant";
import { useAuth } from "@/lib/auth/useAuth";

export function FloatingAIButton() {
  const { orgId } = useAuth();
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Lock body scroll when AI chat is open
  useEffect(() => {
    if (showAIAssistant) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAIAssistant]);

  if (!orgId) return null;

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-6 w-6 group-hover:animate-pulse" />

        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-card border rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
          Ask AI
        </span>
      </button>

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 pt-16 sm:p-4 z-[100] overflow-hidden">
          <div className="w-full h-full max-h-[calc(100vh-64px)] sm:h-auto sm:max-h-[85vh] sm:max-w-xl rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <AIAssistant
              orgId={orgId}
              onClose={() => setShowAIAssistant(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
