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
      // Prevent iOS Safari bounce scroll
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [showAIAssistant]);

  if (!orgId) return null;

  return (
    <>
      {/* Floating AI Button - positioned to respect safe areas */}
      <button
        onClick={() => setShowAIAssistant(true)}
        className="fixed z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group touch-manipulation"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom, 0px) + 0.75rem)",
          right: "max(1rem, env(safe-area-inset-right, 0px) + 0.75rem)",
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 group-hover:animate-pulse" />

        {/* Tooltip - hidden on mobile */}
        <span className="hidden sm:block absolute right-full mr-3 px-3 py-1.5 bg-card border rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
          Ask AI
        </span>
      </button>

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] overflow-hidden"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
          }}
        >
          <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-xl rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
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
