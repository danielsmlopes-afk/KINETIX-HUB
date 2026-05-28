# 🗄️ KINETIX HUB - Database & Seed

## Exceções Isométricas e Especiais (IronLog V2)
O script de injeção e laboratório `seedLaboratory.ts` utiliza transações robustas para mapear as Fichas. As seguintes exceções isométricas nos campos de repetição (`reps`) foram adicionadas:

1. **Prancha (Isometria):** 
   - `reps: '40s'`, `notes: '1 minuto de descanso'`
2. **Rolete:**
   - `reps: 'N'`, `notes: '1 minuto de descanso'`

Para os exercícios padrão de hipertrofia o esquema utiliza `sets: 3, reps: '10'`.