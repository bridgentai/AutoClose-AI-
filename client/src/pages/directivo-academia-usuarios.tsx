"use client";

import { Link } from "wouter";
import { BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard } from "@/components/directivo-guard";

const subItems = [
  {
    title: "Cursos y estudiantes",
    path: "/directivo/cursos",
    icon: BookOpen,
    description: "Grupos, cursos y listado de estudiantes por grupo.",
  },
  {
    title: "Profesores",
    path: "/directivo/profesores",
    icon: GraduationCap,
    description: "Listado de profesores del colegio y acceso a horarios.",
  },
];

export default function DirectivoAcademiaUsuariosPage() {
  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-6" data-testid="directivo-academia-usuarios">
      <NavBackButton to="/directivo/academia" label="Academia" />
      <h1 className="text-2xl font-bold mb-2 text-white font-['Poppins']">
        Usuarios
      </h1>
      <p className="text-white/60 text-sm mb-6">
        Gestiona cursos y estudiantes o el listado de profesores del colegio.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#1e3cff]" />
                <span className="text-lg font-medium text-white">{item.title}</span>
                <span className="text-sm text-white/60 mt-1 text-center">
                  {item.description}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
    </DirectivoGuard>
  );
}
