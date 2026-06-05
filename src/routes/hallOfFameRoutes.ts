import { Hono } from 'hono';
import { hallOfFameController } from '@/controllers/hallOfFameController';

const hallOfFameRoutes = new Hono();

hallOfFameRoutes.get('/', hallOfFameController.getRecords);
hallOfFameRoutes.get('/:id/dossier', hallOfFameController.getDossier);
hallOfFameRoutes.patch('/:id/toggle-pr', hallOfFameController.togglePr);

export default hallOfFameRoutes;