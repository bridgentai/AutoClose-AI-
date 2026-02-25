import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GradingCategory } from '@/hooks/useCourseGrading';
import type { PerformanceSnapshotResponse } from '@/hooks/useCourseGrading';
import type { RiskAssessmentResponse } from '@/hooks/useCourseGrading';
import { CategoryDetailPanel } from './CategoryDetailPanel';

interface AssignmentForCategory {
  _id: string;
  titulo: string;
  fechaEntrega: string;
  maxScore?: number;
  courseId?: string;
  submissions?: { estudianteId: string; calificacion?: number }[];
  categoryId?: string;
  logroCalificacionId?: string;
}

interface CategoryOverviewGridProps {
  categories: GradingCategory[];
  snapshot: PerformanceSnapshotResponse | null;
  risk: RiskAssessmentResponse | null;
  assignmentsByCategoryId: Record<string, AssignmentForCategory[]>;
  studentId: string;
  courseId: string;
  onGradeSubmit?: () => void;
}

export function CategoryOverviewGrid({
  categories,
  snapshot,
  risk,
  assignmentsByCategoryId,
  studentId,
  courseId,
  onGradeSubmit,
}: CategoryOverviewGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    categories.length > 0 ? categories[0]._id : null
  );

  const riskColor =
    risk?.level === 'high'
      ? 'bg-red-500/20 border-red-500/40 text-red-300'
      : risk?.level === 'medium'
        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((cat) => {
        const impact = snapshot?.categoryImpacts?.[cat._id];
        const avg = snapshot?.categoryAverages?.[cat._id];
        const assignments = assignmentsByCategoryId[cat._id] ?? [];
        const isExpanded = expandedId === cat._id;
        const impactPct = impact != null ? Math.min(100, (impact / (snapshot?.weightedFinalAverage || 1)) * 100) : 0;

        return (
          <Card
            key={cat._id}
            className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl overflow-hidden"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-white font-semibold font-['Poppins']">{cat.nombre}</h3>
                  <p className="text-white/60 text-sm">
                    Peso {cat.weight}% · Promedio categoría:{' '}
                    {avg != null ? avg.toFixed(1) : '—'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/80 hover:bg-white/10"
                  onClick={() => setExpandedId(isExpanded ? null : cat._id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#002366] to-[#1e3cff] rounded-full transition-all"
                    style={{ width: `${Math.max(0, impactPct)}%` }}
                  />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColor}`}>
                  {risk?.level ?? '—'}
                </span>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0 border-t border-white/10">
                <CategoryDetailPanel
                  category={cat}
                  assignments={assignments}
                  studentId={studentId}
                  courseId={courseId}
                  currentCategoryAverage={avg}
                  onGradeSubmit={onGradeSubmit}
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
