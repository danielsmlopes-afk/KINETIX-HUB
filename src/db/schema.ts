import { pgTable, uuid, text, integer, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

export const athletes = pgTable('athletes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
});

export const consumables = pgTable('consumables', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'gel' ou 'salt'
  name: text('name').notNull(),
  currentStock: integer('current_stock').notNull().default(0),
  alertThreshold: integer('alert_threshold').notNull().default(0),
});

export const exercises = pgTable('exercises', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
});

export const shoes = pgTable('shoes', {
  id: uuid('id').defaultRandom().primaryKey(),
  stravaGearId: text('strava_gear_id').notNull(),
  name: text('name').notNull(),
  mileage: doublePrecision('mileage').notNull().default(0),
});

export const races = pgTable('races', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull(),
  date: timestamp('date').notNull(),
  distance: doublePrecision('distance').notNull(),
  startTime: text('start_time').notNull(),
  startLocation: text('start_location').notNull(),
});

export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  athleteId: uuid('athlete_id').references(() => athletes.id),
  date: timestamp('date').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
});

export const treadmillIntervals = pgTable('treadmill_intervals', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => workoutSessions.id),
  distanceMeters: doublePrecision('distance_meters').notNull(),
  speedKmh: doublePrecision('speed_kmh').notNull(),
});

export const bioimpedanceLogs = pgTable('bioimpedance_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  athleteId: uuid('athlete_id').references(() => athletes.id),
  weightKg: doublePrecision('weight_kg').notNull(),
  bodyFatPercentage: doublePrecision('body_fat_percentage').notNull(),
  bmr: doublePrecision('bmr').notNull(),
  date: timestamp('date').defaultNow().notNull(),
});