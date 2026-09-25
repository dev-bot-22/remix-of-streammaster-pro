"use client";

import { Toaster } from "sonner";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Prevent hydration errors with Toaster by only rendering it after mount
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {children}
      {mounted && (
        <Toaster
          position="bottom-center"
          expand={false}
          richColors
        />
      )}
    </>
  );
}
