import { pgTable, text, integer, timestamp, doublePrecision, boolean, jsonb, unique, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Validador centralizado de UUID para blindar o banco e evitar crash (NeonDbError)
const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export const safeUuid = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'uuid';
  },
  toDriver(val: string) {
    if (!isUUID(val)) {
      const err = new Error(`Drizzle ORM interceptou um UUID mal formatado antes da query: "${val}"`);
      err.name = 'DrizzleValidationError';
      throw err;
    }
    return val;
  },
});

export const athletes = pgTable('athletes', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: text('name').notNull(),
  stravaAccessToken: text('strava_access_token'),
  stravaRefreshToken: text('strava_refresh_token'),
  stravaExpiresAt: integer('strava_expires_at'),
  // Âncoras geográficas para o Motor Logístico (D-1)
  homeLat: doublePrecision('home_lat'),
  homeLon: doublePrecision('home_lon'),
});

export const consumables = pgTable('consumables', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  type: text('type').notNull(), // 'gel' ou 'salt'
  name: text('name').notNull(),
  currentStock: integer('current_stock').notNull().default(0),
  alertThreshold: integer('alert_threshold').notNull().default(0),
});

export const exercises = pgTable('exercises', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
});

export const shoes = pgTable('shoes', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  stravaGearId: text('strava_gear_id').notNull(),
  name: text('name').notNull(),
  mileage: doublePrecision('mileage').notNull().default(0),
});

export const exerciseLibrary = pgTable('exercise_library', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipmentType: text('equipment_type'),
});

export const workoutTemplates = pgTable('workout_templates', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  warmup: text('warmup'),
  cooldown: text('cooldown'),
});

export const workoutTemplateItems = pgTable('workout_template_items', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  templateId: safeUuid('template_id').notNull().references(() => workoutTemplates.id, { onDelete: 'cascade' }),
  exerciseId: safeUuid('exercise_id').notNull().references(() => exerciseLibrary.id, { onDelete: 'restrict' }),
  sets: integer('sets').notNull(),
  reps: text('reps').notNull(),
  notes: text('notes'),
});

export const races = pgTable('races', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  category: text('category').notNull(),
  date: timestamp('date').notNull(),
  distance: doublePrecision('distance').notNull(),
  startTime: text('start_time').notNull(),
  startLocation: text('start_location').notNull(),
  // Coordenadas e endereço para roteamento preditivo (OSRM)
  address: text('address'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  name: text('name'),
  polyline: text('polyline'),
  movingTime: integer('moving_time'),
  weather: text('weather'),
  isTarget: boolean('is_target').default(false),
  targetPace: text('target_pace'),
  priority: text('priority'),
  // Métrica Cartográfica
  elevationGain: integer('elevation_gain'),
});

export const workoutSessions = pgTable('workout_sessions', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  athleteId: safeUuid('athlete_id').references(() => athletes.id),
  date: timestamp('date').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  load: doublePrecision('load'),
  distance: doublePrecision('distance'),
  gearId: text('gear_id'),
  averageHeartRate: integer('average_heartrate'),
  warmup: text('warmup'),
  cooldown: text('cooldown'),
  mapPolyline: text('map_polyline'),
  weather: text('weather'),
});

export const treadmillIntervals = pgTable('treadmill_intervals', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  sessionId: safeUuid('session_id').references(() => workoutSessions.id),
  distanceMeters: doublePrecision('distance_meters').notNull(),
  speedKmh: doublePrecision('speed_kmh').notNull(),
});

export const bioimpedanceLogs = pgTable('bioimpedance_logs', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  athleteId: safeUuid('athlete_id').references(() => athletes.id),
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
}, (t) => ({
  unq: unique().on(t.athleteId, t.date),
}));

export const plannedWorkouts = pgTable('planned_workouts', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  athleteId: safeUuid('athlete_id').references(() => athletes.id).notNull(),
  date: timestamp('date').notNull(),
  activityType: text('activity_type').notNull(),
  title: text('title').notNull(),
  // Detalhamento fracionado tático e tempos de repouso
  warmup: text('warmup'),
  cooldown: text('cooldown'),
  details: jsonb('details'),
  isImported: boolean('is_imported').default(true),
  complianceStatus: text('compliance_status'), // 'VALIDATED' | 'COMPLETED_NOT_VALIDATED' | null
  // V12.2 - Orquestração de Macrociclo e Digital Twin
  mesocycleStage: integer('mesocycle_stage'), // 1=Base, 2=Carga, 3=Pico, 4=Deload/Taper
  macrocycleTarget: text('macrocycle_target'),
  longRunPerformanceLog: jsonb('long_run_performance_log'),
});

export const cronLogs = pgTable('cron_logs', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  jobName: text('job_name').notNull(),
  runAt: timestamp('run_at').defaultNow().notNull(),
  status: text('status').notNull(),
  message: text('message'),
});

export const pendingActions = pgTable('pending_actions', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  athleteId: safeUuid('athlete_id').references(() => athletes.id).notNull(),
  workoutId: safeUuid('workout_id').notNull(),
  action: text('action').notNull(), // 'RESCHEDULE' | 'CANCEL'
  newDate: timestamp('new_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const strengthLogs = pgTable('strength_logs', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  sessionId: safeUuid('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: safeUuid('exercise_id').notNull().references(() => exerciseLibrary.id, { onDelete: 'restrict' }),
  actualSets: integer('actual_sets').notNull(),
  actualReps: text('actual_reps').notNull(),
  weightUsed: doublePrecision('weight_used'),
  notes: text('notes'),
});

export const monumentRecords = pgTable('monument_records', {
  id: safeUuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  athleteId: safeUuid('athlete_id').references(() => athletes.id),
  year: integer('year').notNull(),
  eventName: text('event_name').notNull(),
  distance: text('distance').notNull(),
  officialTime: text('official_time').notNull(),
  pace: text('pace').notNull(),
  weather: text('weather'),
  polyline: text('polyline'),
  isAllTimePr: boolean('is_all_time_pr').default(false),
});