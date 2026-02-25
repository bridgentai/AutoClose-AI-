import { AssignmentGradeCard } from './AssignmentGradeCard';
import type { GradingCategory } from '@/hooks/useCourseGrading';

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

interface CategoryDetailPanelProps {
  category: GradingCategory;
  assignments: AssignmentForCategory[];
  studentId: string;
  courseId: string;
  currentCategoryAverage?: number;
  onGradeSubmit?: () => void;
}

export function CategoryDetailPanel({
  category,
  assignments,
  studentId,
  courseId,
  currentCategoryAverage,
  onGradeSubmit,
}: CategoryDetailPanelProps) {
  return (
    <div className="space-y-3 pt-3">
      {assignments.length === 0 ? (
        <p className="text-white/50 text-sm">No hay asignaciones en esta categoría.</p>
      ) : (
        assignments.map((a) => {
          const sub = a.submissions?.find(
            (s) => String(s.estudianteId) === String(studentId)
          );
          const grade = sub?.calificacion;
          return (
            <AssignmentGradeCard
              key={a._id}
              assignmentId={a._id}
              title={a.titulo}
              maxScore={a.maxScore ?? 100}
              currentScore={grade}
              studentId={studentId}
              courseId={courseId}
              categoryWeight={category.weight}
              currentCategoryAverage={currentCategoryAverage}
              onSuccess={onGradeSubmit}
            />
          );
        })
      )}
    </div>
  );
}
