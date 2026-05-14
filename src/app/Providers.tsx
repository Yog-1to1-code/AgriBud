"use client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DemoProvider } from "@/contexts/DemoContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <DemoProvider>
        {children}
      </DemoProvider>
    </LanguageProvider>
  );
}
