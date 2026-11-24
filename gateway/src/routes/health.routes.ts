import { Router } from 'express';
import { healthHandler } from '@chuno/shared';

export function createHealthRouter(serviceName: string): Router {
  const router = Router();
  router.get('/', healthHandler({ service: serviceName }));
  return router;
}
