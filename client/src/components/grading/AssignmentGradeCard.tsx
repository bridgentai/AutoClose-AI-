import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSubmitGrade } from '@/hooks/useCourseGrading';
import { useToast } from '@/hooks/use-toast';

interface AssignmentGradeCardProps {
  assignmentId: string;
  title: string;
  maxScore: number;
  currentScore?: number;
  studentId: string;
  courseId: string;
  categoryWeight: number;
  currentCategoryAverage?: number;
  onSuccess?: () => void;
}

export function AssignmentGradeCard({
  assignmentId,
  title,
  maxScore,
  currentScore,
  studentId,
  courseId,
  categoryWeight,
  currentCategoryAverage,
  onSuccess,
}: AssignmentGradeCardProps) {
  const [value, setValue] = useState(
    currentScore != null ? String(currentScore) : ''
  );
  const submitGrade = useSubmitGrade();
  const { toast } = useToast();

  const numValue = value === '' ? undefined : Number(value);
  const isValid = numValue === undefined || (numValue >= 0 && numValue <= maxScore);

  const handleSubmit = () => {
    if (numValue === undefined || numValue < 0 || numValue > maxScore) {
      toast({
        title: 'Error',
        description: `Ingresa una calificación entre 0 y ${maxScore}.`,
        variant: 'destructive',
      });
      return;
    }
    submitGrade.mutate(
      {
        assignmentId,
        studentId,
        score: numValue,
        maxScore,
      },
      {
        onSuccess: () => {
          toast({ title: 'Calificación guardada' });
          onSuccess?.();
        },
        onError: (err: Error) => {
          toast({
            title: 'Error al guardar',
            description: err.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const impactPreview =
    currentCategoryAverage != null &&
    numValue != null &&
    !Number.isNaN(numValue) &&
    categoryWeight > 0
      ? ((numValue - currentCategoryAverage) * categoryWeight) / 100
      : null;

  return (
    <Card className="bg-white/5 border-white/10 rounded-xl">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-white font-medium truncate">{title}</p>
            <p className="text-white/50 text-sm">Máx. {maxScore} pts</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={maxScore}
              step={0.5}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 bg-white/10 border-white/20 text-white h-9"
              placeholder="—"
            />
            <Button
              size="sm"
              className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
              onClick={handleSubmit}
              disabled={!value || !isValid || submitGrade.isPending}
            >
              {submitGrade.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
        {impactPreview != null && (
          <p className="text-xs text-[#00c8ff] mt-2">
            Impacto estimado en final: {impactPreview >= 0 ? '+' : ''}
            {impactPreview.toFixed(1)} pts
          </p>
        )}
      </CardContent>
    </Card>
  );
}
