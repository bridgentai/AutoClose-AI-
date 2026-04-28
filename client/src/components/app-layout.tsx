"use client";

import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { AIDock } from "./ai-dock";
import { cn } from "@/lib/utils";
import glcShield from "@/assets/glc-shield.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  const isEvoDrive = location === "/evo-drive";
  const isEvoSend = location === "/evo-send";
  const isFullBleedShell = isEvoDrive || isEvoSend;

  useEffect(() => {
    const openCommand = () => setCommandOpen(true);
    window.addEventListener("evos:open-command-palette", openCommand);
    return () => window.removeEventListener("evos:open-command-palette", openCommand);
  }, []);

  return (
    <div className="h-svh max-h-svh min-h-0 w-full relative overflow-hidden flex flex-col">
      {/* Escudo (arriba derecha) */}
      <div className="fixed top-4 right-4 z-20 pointer-events-none">
        <img
          src={glcShield}
          alt="GLC"
          className="w-9 h-9 opacity-95 drop-shadow"
          style={{
            filter: "brightness(1.18) saturate(1.08) contrast(1.02)",
          }}
        />
      </div>

      {/* Mismo fondo que Tabla completa de notas: radial #1E3A8A → #0F172A → #020617 */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at 50% 0%, #1E3A8A 0%, #0F172A 40%, #020617 100%)",
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
      <div className="relative z-10 text-white flex-1 min-h-0 flex flex-col">
        {/* Content Area - with dynamic padding for AI Dock and Chat */}
        <div
          className={cn(
            "flex flex-col flex-1 min-h-0 overflow-hidden transition-all duration-500 ease-in-out",
            isChatOpen ? "pr-96" : isDockExpanded ? "pr-80" : "pr-16"
          )}
        >
          <main
            className={cn(
              "story-section flex flex-col flex-1 min-h-0",
              isFullBleedShell ? "!overflow-y-hidden" : "overflow-hidden"
            )}
          >
            {isFullBleedShell ? (
              <div className="flex flex-col flex-1 min-h-0 w-full max-h-full overflow-hidden">
                {children}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full overscroll-y-contain">
                <div
                  className={cn(
                    "max-w-7xl mx-auto px-4 sm:px-6 lg:px-10",
                    "pt-4 sm:pt-6",
                    "pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:pb-[max(1.75rem,env(safe-area-inset-bottom,0px))]"
                  )}
                >
                  {children}
                </div>
              </div>
            )}
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
