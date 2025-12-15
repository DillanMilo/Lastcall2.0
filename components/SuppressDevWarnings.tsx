"use client";

import { useEffect } from "react";

/**
 * Suppresses known false-positive development warnings from Next.js 15.5+
 * These warnings come from dev tools (Cursor, React DevTools) trying to
 * enumerate params/searchParams which are now Promises.
 * 
 * Safe to use - these don't affect production builds.
 */
export function SuppressDevWarnings() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const originalError = console.error;
    
    console.error = (...args) => {
      // Suppress Next.js 15 params/searchParams enumeration warnings from dev tools
      const message = args[0]?.toString() || "";
      
      if (
        message.includes("params are being enumerated") ||
        message.includes("searchParams") && message.includes("should be unwrapped") ||
        message.includes("React.use()") && message.includes("params")
      ) {
        return; // Suppress this warning
      }
      
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}

