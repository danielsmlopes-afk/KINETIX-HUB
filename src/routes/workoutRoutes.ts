import { Hono } from 'hono';
import { workoutController } from '@/controllers/workoutController';

const workoutRoutes = new Hono();

workoutRoutes.post('/validate-manual', workoutController.validateManual);

export { workoutRoutes };