import { Hono } from 'hono';
import { dossierController } from '../controllers/dossierController';

export const dossierRoutes = new Hono();

// Endpoints consumidos pelo "dossier_panel.dart"
dossierRoutes.get('/', dossierController.listDossiers);
dossierRoutes.get('/me', dossierController.getDossier);