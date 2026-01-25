"use client";

import { ReactNode, useState } from "react";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { AIDock } from "./ai-dock";
import { cn } from "@/lib/utils";
import { useInstitutionColors } from "@/hooks/useInstitutionColors";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  
  // Cargar y aplicar colores de la institución
  const { colorPrimario, colorSecundario } = useInstitutionColors();

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Background Gradient with Animation */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: "linear-gradient(135deg, #0a0a0c 0%, #1a001c 50%, #3d0045 100%)",
        }}
      />
      
      {/* Animated Background Orbs - usando colores dinámicos */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div 
          className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl animate-float" 
          style={{ 
            backgroundColor: `${colorPrimario}10` // 10% de opacidad
          }} 
        />
        <div 
          className="absolute bottom-20 right-20 w-80 h-80 rounded-full blur-3xl animate-float" 
          style={{ 
            animationDelay: '1s',
            backgroundColor: `${colorSecundario}10` // 10% de opacidad
          }} 
        />
        <div 
          className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full blur-3xl animate-pulse-glow" 
          style={{ 
            animationDelay: '2s',
            backgroundColor: `${colorPrimario}05` // 5% de opacidad
          }} 
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

