import { Hono } from 'hono';
import { gearController } from '@/controllers/gearController';

export const gearRoutes = new Hono();

gearRoutes.get('/shoes', gearController.getShoes);
gearRoutes.post('/shoes', gearController.addShoe);

gearRoutes.get('/consumables', gearController.getConsumables);
gearRoutes.post('/consumables/:id/replenish', gearController.replenishConsumable);
