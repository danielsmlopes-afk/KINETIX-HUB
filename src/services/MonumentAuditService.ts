import { db } from '@/db';
import { races, monumentRecords } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { athleteRepository } from '@/repositories/athleteRepository';

export class MonumentAuditService {
  public async auditRaces() {
    console.log('🏆 Iniciando Auditoria de Monumentos (Races -> Monuments)...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) {
      console.error('❌ Atleta primário não encontrado.');
      return;
    }

    const allRaces = await db.select().from(races);
    const existingMonuments = await db.select().from(monumentRecords).where(eq(monumentRecords.athleteId, athlete.id));

    let newMonumentsCount = 0;

    for (const race of allRaces) {
      if (!race.movingTime || !race.name) continue;

      const categoryMatch = this.getOfficialDistanceAndName(race.distance);
      if (!categoryMatch) continue;

      const year = race.date.getFullYear();
      
      // Evitar duplicatas verificando pelo nome e ano
      const exists = existingMonuments.some(m => m.eventName === race.name && m.year === year);
      if (exists) continue;

      const pace = this.calculatePace(race.movingTime, categoryMatch.exactDistance);
      const officialTime = this.formatTime(race.movingTime);

      // Auditoria de PRs
      const isAllTimePr = this.checkAllTimePr(race.movingTime, categoryMatch.name, existingMonuments);
      const isYearPr = this.checkYearPr(race.movingTime, categoryMatch.name, year, existingMonuments);

      // Se bater PR absoluto, rebaixa os anteriores da mesma distância
      if (isAllTimePr) {
        existingMonuments.forEach(m => {
          if ((m.raceCategory || m.distance) === categoryMatch.name) m.isAllTimePr = false;
        });
        await db.update(monumentRecords)
          .set({ isAllTimePr: false })
          .where(and(eq(monumentRecords.athleteId, athlete.id), eq(monumentRecords.raceCategory, categoryMatch.name)));
      }

      // Se bater PR do ano, rebaixa os anteriores da mesma distância naquele ano
      if (isYearPr) {
        existingMonuments.forEach(m => {
          if ((m.raceCategory || m.distance) === categoryMatch.name && m.year === year) m.isYearPr = false;
        });
        await db.update(monumentRecords)
          .set({ isYearPr: false })
          .where(
            and(
              eq(monumentRecords.athleteId, athlete.id),
              eq(monumentRecords.raceCategory, categoryMatch.name),
              eq(monumentRecords.year, year)
            )
          );
      }

      let temperature: number | null = null;
      if (race.weather) {
        const match = race.weather.match(/(-?\d+)\s*°C/i);
        if (match) {
          temperature = parseInt(match[1], 10);
        }
      }

      const inserted = await db.insert(monumentRecords).values({
        athleteId: athlete.id,
        year,
        eventName: race.name,
        distance: categoryMatch.exactDistance.toString(),
        raceCategory: categoryMatch.name,
        officialTime,
        pace,
        weather: race.weather || '--',
        temperature,
        locationCity: race.startLocation || 'Desconhecida',
        date: race.date,
        polyline: race.polyline || null,
        mapImageUrl: race.mapImageUrl || null,
        isAllTimePr,
        isYearPr
      }).returning();

      existingMonuments.push(inserted[0]);
      newMonumentsCount++;
      
      console.log(`🏅 Promovido: ${race.name} (${categoryMatch.name}) | Tempo: ${officialTime} | PR Absoluto: ${isAllTimePr} | PR Ano: ${isYearPr}`);
    }

    console.log(`\n✅ Auditoria concluída. ${newMonumentsCount} novos monumentos registrados na Base de Dados.`);
  }

  private getOfficialDistanceAndName(distance: number): { exactDistance: number, name: string } | null {
    if (distance >= 9.6 && distance <= 10.5) return { exactDistance: 10, name: '10K' };
    if (distance >= 14.6 && distance <= 15.5) return { exactDistance: 15, name: '15K' };
    if (distance >= 20.8 && distance <= 21.6) return { exactDistance: 21.097, name: '21K' };
    if (distance >= 41.8 && distance <= 42.8) return { exactDistance: 42.195, name: '42K' };
    return null;
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private calculatePace(movingTime: number, exactDistance: number): string {
    const paceSeconds = Math.round(movingTime / exactDistance);
    const m = Math.floor(paceSeconds / 60);
    const s = paceSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] * 60 + parts[1];
  }

  private checkAllTimePr(newTimeSeconds: number, distanceName: string, existingMonuments: any[]): boolean {
    const records = existingMonuments.filter(m => (m.raceCategory || m.distance) === distanceName);
    if (records.length === 0) return true;
    const bestTime = Math.min(...records.map(r => this.timeToSeconds(r.officialTime)));
    return newTimeSeconds < bestTime;
  }

  private checkYearPr(newTimeSeconds: number, distanceName: string, year: number, existingMonuments: any[]): boolean {
    const records = existingMonuments.filter(m => (m.raceCategory || m.distance) === distanceName && m.year === year);
    if (records.length === 0) return true;
    const bestTime = Math.min(...records.map(r => this.timeToSeconds(r.officialTime)));
    return newTimeSeconds < bestTime;
  }
}
