"use client";

import { Clock, BookOpen, User } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AsignacionHorariosIndexPage() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-0 w-full"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="relative z-10 w-full flex flex-col min-h-0 p-6 md:p-10 max-w-4xl mx-auto">
        <div className="mb-6">
          <NavBackButton to="/dashboard" label="Dashboard" />
        </div>

        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#3B82F6]" />
            Asignación de Horarios
          </h1>
          <p className="text-white/60 text-sm">
            Elige el módulo con el que deseas trabajar: horarios por curso (grupo) o por profesor.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer group transition-all duration-300 border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-[#3B82F6]/30 hover:shadow-lg hover:shadow-[#3B82F6]/10"
            onClick={() => setLocation("/asignacion-horarios/curso")}
          >
            <CardHeader className="pb-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 bg-[#3B82F6]/20 border border-[#3B82F6]/30">
                <BookOpen className="w-7 h-7 text-[#3B82F6]" />
              </div>
              <CardTitle className="text-[#E2E8F0] text-xl font-['Poppins']">Horarios Curso</CardTitle>
              <CardDescription className="text-white/60 text-sm">
                Ver y gestionar el horario por grupo o curso. Plantilla Día 1 a 6 por período.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <span className="text-xs font-medium text-[#3B82F6] group-hover:underline">Entrar →</span>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer group transition-all duration-300 border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-[#10B981]/30 hover:shadow-lg hover:shadow-emerald-500/10"
            onClick={() => setLocation("/asignacion-horarios/profesor")}
          >
            <CardHeader className="pb-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 bg-emerald-500/20 border border-emerald-500/30">
                <User className="w-7 h-7 text-emerald-400" />
              </div>
              <CardTitle className="text-[#E2E8F0] text-xl font-['Poppins']">Horarios Profesor</CardTitle>
              <CardDescription className="text-white/60 text-sm">
                Ver y gestionar el horario por profesor. Plantilla Día 1 a 6 por período.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <span className="text-xs font-medium text-emerald-400 group-hover:underline">Entrar →</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
