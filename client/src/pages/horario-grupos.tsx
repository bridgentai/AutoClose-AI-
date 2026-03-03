"use client";

import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/authContext";

interface ProfessorGroupAssignment {
  groupId: string;
  subjects: { _id: string; nombre: string }[];
  totalStudents: number;
}

const generateColorFromId = (id: string): string => {
  if (!id) return "#002366";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#002366", "#1e3cff", "#3b82f6", "#10b981", "#8b5cf6", "#06b6d4"];
  return colors[Math.abs(hash) % colors.length];
};

export default function HorarioGruposPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: groups = [], isLoading } = useQuery<ProfessorGroupAssignment[]>({
    queryKey: ["professorGroups"],
    queryFn: () => apiRequest("GET", "/api/professor/my-groups"),
    enabled: user?.rol === "profesor",
  });

  if (user && user.rol !== "profesor") {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="mb-6">
        <NavBackButton to="/profesor/academia" label="Academia" />
      </div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
          <Clock className="w-7 h-7 text-[#3B82F6]" />
          Horario Escolar
        </h1>
        <p className="text-white/60 text-sm">
          Selecciona un grupo para ver su horario y registrar asistencia
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="min-h-[180px] bg-white/5 border-white/10 animate-pulse">
              <CardHeader><div className="h-8 bg-white/10 rounded" /></CardHeader>
              <CardContent><div className="h-10 bg-white/10 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
          <Clock className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <p className="text-white/60">No tienes grupos asignados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groups.map((group) => {
            const groupDisplay = group.groupId.toUpperCase().trim();
            const color = generateColorFromId(group.groupId);
            return (
              <Card
                key={group.groupId}
                className="flex flex-col min-h-[200px] bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer group transition-all duration-300 hover:bg-white/[0.07] overflow-hidden"
                onClick={() => setLocation(`/course/${group.groupId}/horario`)}
              >
                <CardHeader className="flex-1 p-6 pb-2">
                  <div className="flex items-center justify-between mb-4 min-h-[48px]">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}25`, border: `2px solid ${color}50` }}
                    >
                      <Clock className="w-6 h-6" style={{ color }} />
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-[#E2E8F0] mb-2 truncate">{groupDisplay}</h3>
                  <p className="text-sm text-white/60">
                    <Users className="w-4 h-4 inline mr-1" />
                    {group.totalStudents ?? 0} estudiantes
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <Button
                    size="sm"
                    className="w-full rounded-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/course/${group.groupId}/horario`);
                    }}
                  >
                    Ver horario
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
