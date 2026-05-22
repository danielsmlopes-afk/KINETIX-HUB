import { pgTable, uuid, text, integer, timestamp, doublePrecision, boolean, jsonb } from 'drizzle-orm/pg-core';

export const athletes = pgTable('athletes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  stravaAccessToken: text('strava_access_token'),
  stravaRefreshToken: text('strava_refresh_token'),
  stravaExpiresAt: integer('strava_expires_at'),
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

export const exerciseLibrary = pgTable('exercise_library', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipmentType: text('equipment_type'),
});

export const workoutTemplates = pgTable('workout_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

export const workoutTemplateItems = pgTable('workout_template_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => workoutTemplates.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull().references(() => exerciseLibrary.id, { onDelete: 'restrict' }),
  sets: integer('sets').notNull(),
  reps: text('reps').notNull(),
  notes: text('notes'),
});

export const races = pgTable('races', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull(),
  date: timestamp('date').notNull(),
  distance: doublePrecision('distance').notNull(),
  startTime: text('start_time').notNull(),
  startLocation: text('start_location').notNull(),
  name: text('name'),
  polyline: text('polyline'),
  movingTime: integer('moving_time'),
  weather: text('weather'),
  isTarget: boolean('is_target').default(false),
});

export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  athleteId: uuid('athlete_id').references(() => athletes.id),
  date: timestamp('date').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  load: doublePrecision('load'),
  distance: doublePrecision('distance'),
  gearId: text('gear_id'),
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
  date: timestamp('date').notNull(),
  weight: doublePrecision('weight').notNull(),
  bodyFat: doublePrecision('body_fat').notNull(),
  muscleMass: doublePrecision('muscle_mass').notNull(),
  bodyWater: doublePrecision('body_water').notNull(),
  visceralFat: doublePrecision('visceral_fat').notNull(),
  metabolicAge: integer('metabolic_age').notNull(),
  tmb: doublePrecision('tmb').notNull(),
  protein: doublePrecision('protein').notNull(),
  boneMass: doublePrecision('bone_mass').notNull(),
  healthNotes: text('health_notes'),
});

export const plannedWorkouts = pgTable('planned_workouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  athleteId: uuid('athlete_id').references(() => athletes.id).notNull(),
  date: timestamp('date').notNull(),
  activityType: text('activity_type').notNull(),
  title: text('title').notNull(),
  details: jsonb('details'),
  isImported: boolean('is_imported').default(true),
});

export const cronLogs = pgTable('cron_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobName: text('job_name').notNull(),
  runAt: timestamp('run_at').defaultNow().notNull(),
  status: text('status').notNull(),
  message: text('message'),
});

export const pendingActions = pgTable('pending_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  athleteId: uuid('athlete_id').references(() => athletes.id).notNull(),
  workoutId: uuid('workout_id').notNull(),
  action: text('action').notNull(), // 'RESCHEDULE' | 'CANCEL'
  newDate: timestamp('new_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});