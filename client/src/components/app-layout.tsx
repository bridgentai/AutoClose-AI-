"use client";

import { ReactNode, useState } from "react";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { AIDock } from "./ai-dock";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(false);

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Caobos en esquina */}
      <div className="fixed top-4 left-4 z-20 pointer-events-none">
        <span className="text-xl font-bold text-white/90 font-['Poppins'] tracking-tight drop-shadow-sm">
          Caobos
        </span>
      </div>

      {/* Mismo fondo que Tabla completa de notas: radial #1E3A8A → #0F172A → #020617 */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)",
        }}
      />
      {/* Orbes sutiles misma paleta */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 left-10 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20 animate-float-slow"
          style={{ backgroundColor: "#1E3A8A" }}
        />
        <div
          className="absolute bottom-20 right-20 w-80 h-80 rounded-full blur-3xl opacity-15 animate-float-slow"
          style={{ backgroundColor: "#3B82F6", animationDelay: "2s" }}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 text-white">
        {/* Content Area - with dynamic padding for AI Dock and Chat */}
        <div
          className={cn(
            "transition-all duration-500 ease-in-out",
            isChatOpen ? "pr-96" : isDockExpanded ? "pr-80" : "pr-16"
          )}
        >
          <main className="story-section">
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

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

