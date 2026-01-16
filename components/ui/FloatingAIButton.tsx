"use client";

import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { AIAssistant } from "@/components/inventory/AIAssistant";
import { useAuth } from "@/lib/auth/useAuth";

export function FloatingAIButton() {
  const { orgId } = useAuth();
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Lock body scroll when AI chat is open
  useEffect(() => {
    if (showAIAssistant) {
      document.body.style.overflow = "hidden";
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
      {/* Floating AI Button */}
      <button
        onClick={() => setShowAIAssistant(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed z-40 floating-button-position group touch-manipulation"
        aria-label="Open AI Assistant"
      >
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl transition-all duration-500 group-hover:bg-primary/30 group-hover:blur-2xl" />

        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-2xl bg-primary/40 animate-ping-slow" />

        {/* Main button */}
        <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-xl shadow-primary/30 flex items-center justify-center transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-primary/40 group-hover:scale-105 group-active:scale-95">
          {/* Inner highlight */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />

          {/* Icon */}
          <Zap className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground relative z-10 transition-transform duration-300 group-hover:scale-110" />

          {/* Decorative corner accent */}
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-background shadow-sm" />
        </div>

        {/* Tooltip */}
        <div
          className={`hidden sm:flex absolute right-full mr-4 items-center gap-2 px-4 py-2 bg-card border border-border/50 rounded-xl shadow-xl transition-all duration-300 whitespace-nowrap pointer-events-none ${
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
          }`}
        >
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Ask Inventory AI</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded text-muted-foreground">AI</kbd>
        </div>
      </button>

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md animate-fade-in"
            onClick={() => setShowAIAssistant(false)}
          />

          {/* Modal Container */}
          <div className="absolute inset-0 flex items-end sm:items-center justify-center modal-safe-padding">
            <div
              className="relative w-full h-full sm:h-[85vh] sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl overflow-hidden shadow-2xl animate-slide-up bg-background border border-border/50"
            >
              {/* Decorative top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

              <AIAssistant
                orgId={orgId}
                onClose={() => setShowAIAssistant(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom animations */}
      <style jsx>{`
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          75%, 100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-ping-slow {
          animation: ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
