# ⚙️ KINETIX HUB - Services Reference

## Coach & Athlete Controllers
Todos os objetos da tabela `plannedWorkouts` processados nos serviços (ex: `coachService.ts`) ou consumidos nas controllers (`athleteController.ts`) aplicam o cast estrito (`as WorkoutDetails`) sobre o campo JSONB `details`. O acesso via raiz tipo `workout.restDetails` foi abolido e agora ocorre exclusivamente via `details.restDetails`. Isso garante deploy cloud-safe no Render mitigando falhas TS2339.