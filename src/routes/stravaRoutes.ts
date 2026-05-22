import { Hono } from 'hono';
import { stravaController } from '../controllers/stravaController';

const stravaRoutes = new Hono();

stravaRoutes.get('/auth', stravaController.login);
stravaRoutes.get('/callback', stravaController.callback);
stravaRoutes.get('/webhook', stravaController.verifyWebhook);
stravaRoutes.post('/webhook', stravaController.handleWebhook);

export { stravaRoutes };