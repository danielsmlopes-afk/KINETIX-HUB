import { Hono } from 'hono';
import { gearController } from '@/controllers/gearController';

export const gearRoutes = new Hono();

gearRoutes.get('/shoes', gearController.getShoes);
gearRoutes.post('/shoes', gearController.addShoe);