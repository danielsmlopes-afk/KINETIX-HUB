import { z } from 'zod';

// Validador individual de Treino
export const workoutItemSchema = z.object({
  date: z.string().datetime(), // Requer padrão ISO (Ex: 2026-06-10T06:00:00Z)
  type: z.enum(['RUN', 'BIKE', 'STRENGTH']),
  title: z.string().min(1),
  details: z.record(z.unknown()).optional(), // JSON flexível protegido contra 'any'
});

// Validador de Batch (A planilha completa)
export const workoutBatchSchema = z.array(workoutItemSchema);

export type WorkoutPayload = z.infer<typeof workoutBatchSchema>;
