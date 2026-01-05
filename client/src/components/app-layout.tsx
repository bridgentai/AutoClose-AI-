"use client";

import { ReactNode, useState } from "react";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { AIDock } from "./ai-dock";
import { BackButton } from "./back-button";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(false);

  return (
    <div className="min-h-screen w-full relative">
      {/* Background Gradient */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: "linear-gradient(135deg, #0a0a0c 0%, #1a001c 50%, #3d0045 100%)",
        }}
      />

      {/* Main Content Container */}
      <div className="relative z-10 text-white">
        {/* Content Area - with dynamic padding for AI Dock and Chat */}
        <div 
          className={cn(
            "transition-all duration-300 ease-in-out",
            isChatOpen ? "pr-96" : isDockExpanded ? "pr-80" : "pr-16"
          )}
        >
          <main>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* AI Dock */}
      <AIDock 
        onOpenCommandPalette={() => setCommandOpen(true)}
        onChatStateChange={(chatOpen, dockExpanded) => {
          setIsChatOpen(chatOpen);
          setIsDockExpanded(dockExpanded);
        }}
      />

      {/* Back Button */}
      <BackButton />

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

