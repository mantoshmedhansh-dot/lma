import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import merchantRoutes from './merchants.js';
import orderRoutes from './orders.js';
import deliveryRoutes from './deliveries.js';
import integrationRoutes from './integrations.js';
import intelligenceRoutes from './intelligence.js';
import analyticsRoutes from './analytics.js';
import notificationRoutes from './notifications.js';
import securityRoutes from './security.js';

const router = Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount routes
router.use('/health', healthRoutes);
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/merchants`, merchantRoutes);
router.use(`${API_VERSION}/orders`, orderRoutes);
router.use(`${API_VERSION}/deliveries`, deliveryRoutes);
router.use(`${API_VERSION}/integrations`, integrationRoutes);
router.use(`${API_VERSION}/intelligence`, intelligenceRoutes);
router.use(`${API_VERSION}/analytics`, analyticsRoutes);
router.use(`${API_VERSION}/notifications`, notificationRoutes);
router.use(`${API_VERSION}/security`, securityRoutes);

export default router;
