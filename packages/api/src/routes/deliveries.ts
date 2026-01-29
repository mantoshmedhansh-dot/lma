import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireDriver } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import {
  optimizeRoute,
  calculateETA,
  estimateDeliveryTime,
  getTrafficMultiplier,
  clusterDeliveries,
  calculateDistance,
} from '../services/routeOptimization.js';

const router = Router();

// Validation schemas
const orderIdSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

const podSchema = z.object({
  delivery_type: z.enum(['standard', 'contactless', 'handed']),
  photo_urls: z.array(z.string().url()).min(1, 'At least one photo is required'),
  signature_url: z.string().url().optional(),
  notes: z.string().optional(),
  delivery_latitude: z.number().optional(),
  delivery_longitude: z.number().optional(),
  cod_collected: z.boolean().optional(),
  cod_amount: z.number().positive().optional(),
  cod_collection_method: z.enum(['cash', 'upi', 'card']).optional(),
  recipient_name: z.string().optional(),
  recipient_relationship: z.enum(['self', 'family', 'security', 'neighbor', 'other']).optional(),
});

const codCollectionSchema = z.object({
  order_id: z.string().uuid(),
  collected_amount: z.number().positive(),
  collection_method: z.enum(['cash', 'upi', 'card']).default('cash'),
  reference_number: z.string().optional(),
});

const codDepositSchema = z.object({
  collection_ids: z.array(z.string().uuid()).min(1),
  deposit_reference: z.string(),
  deposit_account: z.string().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['collected', 'deposited', 'reconciled']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

/**
 * Submit Proof of Delivery
 * POST /api/v1/deliveries/:orderId/pod
 */
router.post(
  '/:orderId/pod',
  authenticate,
  requireDriver,
  validateParams(orderIdSchema),
  validateBody(podSchema),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const podData = req.body as z.infer<typeof podSchema>;

      // Get driver ID from user
      const { data: driver, error: driverError } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', req.user!.id)
        .single();

      if (driverError || !driver) {
        throw ApiError.forbidden('Driver profile not found');
      }

      // Verify order exists and is assigned to this driver
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, status, driver_id, is_cod, total_amount')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw ApiError.notFound('Order not found');
      }

      if (order.driver_id !== driver.id) {
        throw ApiError.forbidden('Order not assigned to you');
      }

      if (order.status === 'delivered') {
        throw new ApiError(400, 'ORDER_ALREADY_DELIVERED', 'Order has already been delivered');
      }

      // Validate signature for handed delivery
      if (podData.delivery_type === 'handed' && !podData.signature_url) {
        throw new ApiError(400, 'SIGNATURE_REQUIRED', 'Signature is required for handed delivery');
      }

      // Validate COD collection
      if (order.is_cod && !podData.cod_collected) {
        throw new ApiError(400, 'COD_NOT_COLLECTED', 'Cash on delivery must be collected');
      }

      // Create POD record
      const { data: pod, error: podError } = await supabaseAdmin
        .from('proof_of_delivery')
        .insert({
          order_id: orderId,
          driver_id: driver.id,
          delivery_type: podData.delivery_type,
          photo_urls: podData.photo_urls,
          signature_url: podData.signature_url || null,
          notes: podData.notes || null,
          delivery_latitude: podData.delivery_latitude || null,
          delivery_longitude: podData.delivery_longitude || null,
          cod_collected: podData.cod_collected || null,
          cod_amount: podData.cod_amount || null,
          cod_collection_method: podData.cod_collection_method || null,
          recipient_name: podData.recipient_name || null,
          recipient_relationship: podData.recipient_relationship || null,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (podError) {
        throw new ApiError(500, 'POD_CREATION_FAILED', 'Failed to create proof of delivery');
      }

      // If COD, create collection record
      if (order.is_cod && podData.cod_collected && podData.cod_amount) {
        await supabaseAdmin.from('cod_collections').insert({
          driver_id: driver.id,
          order_id: orderId,
          expected_amount: order.total_amount,
          collected_amount: podData.cod_amount,
          collection_method: podData.cod_collection_method || 'cash',
          status: 'collected',
        });
      }

      // Update order status to delivered
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          pod_id: pod.id,
          cod_status: order.is_cod ? 'collected' : null,
        })
        .eq('id', orderId);

      // Add status history
      await supabaseAdmin.from('order_status_history').insert({
        order_id: orderId,
        status: 'delivered',
        changed_by: req.user!.id,
        notes: `Delivered via ${podData.delivery_type}`,
      });

      // Update driver stats
      await supabaseAdmin.rpc('increment_driver_deliveries', { driver_id: driver.id });

      sendCreated(res, {
        pod_id: pod.id,
        order_id: orderId,
        message: 'Delivery completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get POD for an order
 * GET /api/v1/deliveries/:orderId/pod
 */
router.get(
  '/:orderId/pod',
  authenticate,
  validateParams(orderIdSchema),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const { data: pod, error } = await supabaseAdmin
        .from('proof_of_delivery')
        .select(`
          *,
          driver:drivers (
            id,
            user:users (
              first_name,
              last_name
            )
          )
        `)
        .eq('order_id', orderId)
        .single();

      if (error || !pod) {
        throw ApiError.notFound('Proof of delivery not found');
      }

      // Verify access (customer, merchant, driver, or admin)
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('customer_id, merchant_id, driver_id')
        .eq('id', orderId)
        .single();

      if (order) {
        const hasAccess =
          order.customer_id === req.user!.id ||
          order.driver_id === (await getDriverId(req.user!.id)) ||
          ['admin', 'super_admin'].includes(req.user!.role);

        if (!hasAccess) {
          throw ApiError.forbidden('You do not have access to this POD');
        }
      }

      sendSuccess(res, pod);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get driver's COD collections
 * GET /api/v1/deliveries/cod/collections
 */
router.get(
  '/cod/collections',
  authenticate,
  requireDriver,
  validateQuery(listQuerySchema),
  async (req, res, next) => {
    try {
      const { page, limit, status, from_date, to_date } = req.query as z.infer<typeof listQuerySchema>;
      const offset = (page - 1) * limit;

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', req.user!.id)
        .single();

      if (!driver) {
        throw ApiError.forbidden('Driver profile not found');
      }

      let query = supabaseAdmin
        .from('cod_collections')
        .select(
          `
          *,
          order:orders (
            order_number,
            merchant:merchants (
              business_name
            )
          )
        `,
          { count: 'exact' }
        )
        .eq('driver_id', driver.id)
        .order('collected_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (from_date) {
        query = query.gte('collected_at', from_date);
      }

      if (to_date) {
        query = query.lte('collected_at', to_date);
      }

      query = query.range(offset, offset + limit - 1);

      const { data: collections, count, error } = await query;

      if (error) {
        throw new ApiError(500, 'DATABASE_ERROR', error.message);
      }

      sendPaginated(res, collections || [], {
        page,
        limit,
        total: count || 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get driver's COD balance
 * GET /api/v1/deliveries/cod/balance
 */
router.get('/cod/balance', authenticate, requireDriver, async (req, res, next) => {
  try {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    if (!driver) {
      throw ApiError.forbidden('Driver profile not found');
    }

    const { data: balance, error } = await supabaseAdmin
      .from('driver_cod_balance')
      .select('*')
      .eq('driver_id', driver.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    sendSuccess(res, balance || {
      pending_amount: 0,
      total_collected: 0,
      total_deposited: 0,
      daily_collection_limit: 10000,
      today_collected: 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record COD deposit
 * POST /api/v1/deliveries/cod/deposit
 */
router.post(
  '/cod/deposit',
  authenticate,
  requireDriver,
  validateBody(codDepositSchema),
  async (req, res, next) => {
    try {
      const { collection_ids, deposit_reference, deposit_account } = req.body as z.infer<
        typeof codDepositSchema
      >;

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', req.user!.id)
        .single();

      if (!driver) {
        throw ApiError.forbidden('Driver profile not found');
      }

      // Verify all collections belong to this driver and are in 'collected' status
      const { data: collections, error: fetchError } = await supabaseAdmin
        .from('cod_collections')
        .select('id, collected_amount')
        .in('id', collection_ids)
        .eq('driver_id', driver.id)
        .eq('status', 'collected');

      if (fetchError) {
        throw new ApiError(500, 'DATABASE_ERROR', fetchError.message);
      }

      if (!collections || collections.length !== collection_ids.length) {
        throw new ApiError(
          400,
          'INVALID_COLLECTIONS',
          'Some collections are invalid or already deposited'
        );
      }

      // Calculate total deposit amount
      const totalAmount = collections.reduce((sum, c) => sum + c.collected_amount, 0);

      // Update collections to deposited status
      const { error: updateError } = await supabaseAdmin
        .from('cod_collections')
        .update({
          status: 'deposited',
          deposited_at: new Date().toISOString(),
          deposit_reference,
          deposit_account,
        })
        .in('id', collection_ids);

      if (updateError) {
        throw new ApiError(500, 'DATABASE_ERROR', 'Failed to update collections');
      }

      sendSuccess(res, {
        message: 'Deposit recorded successfully',
        collection_count: collections.length,
        total_amount: totalAmount,
        deposit_reference,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get available orders for driver
 * GET /api/v1/deliveries/available
 */
router.get('/available', authenticate, requireDriver, async (req, res, next) => {
  try {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, current_latitude, current_longitude')
      .eq('user_id', req.user!.id)
      .single();

    if (!driver) {
      throw ApiError.forbidden('Driver profile not found');
    }

    // Get orders ready for pickup without a driver
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        delivery_fee,
        is_cod,
        cod_amount,
        delivery_address_snapshot,
        delivery_latitude,
        delivery_longitude,
        pickup_address_snapshot,
        pickup_latitude,
        pickup_longitude,
        created_at,
        merchant:merchants (
          id,
          business_name,
          logo_url,
          phone
        ),
        customer:users!orders_customer_id_fkey (
          first_name,
          last_name,
          phone
        ),
        order_items (count)
      `)
      .in('status', ['ready_for_pickup', 'confirmed'])
      .is('driver_id', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    // Transform response with distance calculation (simplified)
    const transformedOrders = orders?.map((order: Record<string, unknown>) => ({
      ...order,
      items_count: (order.order_items as Array<{ count: number }>)?.[0]?.count || 0,
      // Would calculate actual distance using PostGIS or external service
      estimated_distance_km: 5,
      estimated_earnings: order.delivery_fee,
    }));

    sendSuccess(res, transformedOrders || []);
  } catch (error) {
    next(error);
  }
});

/**
 * Accept an order
 * POST /api/v1/deliveries/:orderId/accept
 */
router.post(
  '/:orderId/accept',
  authenticate,
  requireDriver,
  validateParams(orderIdSchema),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id, status')
        .eq('user_id', req.user!.id)
        .single();

      if (!driver) {
        throw ApiError.forbidden('Driver profile not found');
      }

      if (driver.status !== 'online') {
        throw new ApiError(400, 'DRIVER_NOT_ONLINE', 'You must be online to accept orders');
      }

      // Check if driver already has an active order
      const { data: activeOrder } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('driver_id', driver.id)
        .in('status', ['driver_assigned', 'picked_up', 'in_transit', 'arrived'])
        .single();

      if (activeOrder) {
        throw new ApiError(400, 'ALREADY_HAS_ORDER', 'You already have an active delivery');
      }

      // Try to claim the order (atomic update)
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({
          driver_id: driver.id,
          status: 'driver_assigned',
        })
        .eq('id', orderId)
        .in('status', ['ready_for_pickup', 'confirmed'])
        .is('driver_id', null)
        .select()
        .single();

      if (error || !order) {
        throw new ApiError(400, 'ORDER_UNAVAILABLE', 'Order is no longer available');
      }

      // Update driver status
      await supabaseAdmin
        .from('drivers')
        .update({ status: 'on_delivery' })
        .eq('id', driver.id);

      // Add status history
      await supabaseAdmin.from('order_status_history').insert({
        order_id: orderId,
        status: 'driver_assigned',
        changed_by: req.user!.id,
        notes: 'Driver accepted the order',
      });

      sendSuccess(res, {
        message: 'Order accepted successfully',
        order_id: order.id,
        order_number: order.order_number,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update order status (picked up, in transit, arrived)
 * PATCH /api/v1/deliveries/:orderId/status
 */
router.patch(
  '/:orderId/status',
  authenticate,
  requireDriver,
  validateParams(orderIdSchema),
  validateBody(
    z.object({
      status: z.enum(['picked_up', 'in_transit', 'arrived']),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { status, latitude, longitude } = req.body;

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', req.user!.id)
        .single();

      if (!driver) {
        throw ApiError.forbidden('Driver profile not found');
      }

      // Verify order is assigned to this driver
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .eq('driver_id', driver.id)
        .single();

      if (orderError || !order) {
        throw ApiError.notFound('Order not found or not assigned to you');
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        driver_assigned: ['picked_up'],
        picked_up: ['in_transit'],
        in_transit: ['arrived'],
        arrived: [],
      };

      if (!validTransitions[order.status]?.includes(status)) {
        throw new ApiError(
          400,
          'INVALID_STATUS_TRANSITION',
          `Cannot transition from ${order.status} to ${status}`
        );
      }

      // Update order status
      const updateData: Record<string, unknown> = { status };
      if (status === 'picked_up') {
        updateData.picked_up_at = new Date().toISOString();
      }

      await supabaseAdmin.from('orders').update(updateData).eq('id', orderId);

      // Update driver location if provided
      if (latitude && longitude) {
        await supabaseAdmin
          .from('drivers')
          .update({
            current_latitude: latitude,
            current_longitude: longitude,
            last_location_update: new Date().toISOString(),
          })
          .eq('id', driver.id);
      }

      // Add status history
      await supabaseAdmin.from('order_status_history').insert({
        order_id: orderId,
        status,
        changed_by: req.user!.id,
      });

      sendSuccess(res, {
        message: `Order status updated to ${status}`,
        order_id: orderId,
        status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to get driver ID from user ID
async function getDriverId(userId: string): Promise<string | null> {
  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .single();
  return driver?.id || null;
}

// =====================================================
// ROUTE OPTIMIZATION ENDPOINTS
// =====================================================

// Route optimization request schema
const routeOptimizationSchema = z.object({
  locations: z.array(
    z.object({
      id: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      type: z.enum(['pickup', 'delivery']),
      orderId: z.string().optional(),
      address: z.string().optional(),
      estimatedTime: z.number().optional(),
    })
  ).min(1),
  vehicleType: z.enum(['bicycle', 'motorcycle', 'car', 'van']).optional(),
  respectPickupDeliveryOrder: z.boolean().optional(),
});

const etaRequestSchema = z.object({
  from: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  to: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  vehicleType: z.enum(['bicycle', 'motorcycle', 'car', 'van']).optional(),
});

const deliveryEstimateSchema = z.object({
  pickup: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  delivery: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  prepTime: z.number().optional(),
  vehicleType: z.enum(['bicycle', 'motorcycle', 'car', 'van']).optional(),
});

/**
 * Optimize route for multiple stops
 * POST /api/v1/deliveries/route/optimize
 */
router.post(
  '/route/optimize',
  authenticate,
  requireDriver,
  validateBody(routeOptimizationSchema),
  async (req, res, next) => {
    try {
      const { locations, vehicleType, respectPickupDeliveryOrder } =
        req.body as z.infer<typeof routeOptimizationSchema>;

      // Get driver's current location
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('current_latitude, current_longitude, vehicle_type')
        .eq('user_id', req.user!.id)
        .single();

      if (!driver || !driver.current_latitude || !driver.current_longitude) {
        throw new ApiError(
          400,
          'LOCATION_REQUIRED',
          'Driver location is required for route optimization'
        );
      }

      const driverLocation = {
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
      };

      const optimizedRoute = optimizeRoute(driverLocation, locations, {
        vehicleType: vehicleType || driver.vehicle_type || 'motorcycle',
        startTime: new Date(),
        respectPickupDeliveryOrder: respectPickupDeliveryOrder ?? true,
      });

      sendSuccess(res, {
        optimizedRoute,
        driverLocation,
        trafficMultiplier: getTrafficMultiplier(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Calculate ETA between two points
 * POST /api/v1/deliveries/route/eta
 */
router.post(
  '/route/eta',
  authenticate,
  validateBody(etaRequestSchema),
  async (req, res, next) => {
    try {
      const { from, to, vehicleType } = req.body as z.infer<typeof etaRequestSchema>;

      const trafficMultiplier = getTrafficMultiplier();
      const eta = calculateETA(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude,
        vehicleType || 'motorcycle',
        trafficMultiplier
      );

      sendSuccess(res, {
        ...eta,
        trafficMultiplier,
        trafficStatus:
          trafficMultiplier > 1.3 ? 'heavy' : trafficMultiplier > 1.1 ? 'moderate' : 'light',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Estimate delivery time for an order
 * POST /api/v1/deliveries/route/estimate
 */
router.post(
  '/route/estimate',
  authenticate,
  validateBody(deliveryEstimateSchema),
  async (req, res, next) => {
    try {
      const { pickup, delivery, prepTime, vehicleType } =
        req.body as z.infer<typeof deliveryEstimateSchema>;

      const trafficMultiplier = getTrafficMultiplier();
      const estimate = estimateDeliveryTime(
        pickup.latitude,
        pickup.longitude,
        delivery.latitude,
        delivery.longitude,
        {
          vehicleType: vehicleType || 'motorcycle',
          prepTime: prepTime || 15,
          trafficMultiplier,
        }
      );

      const distance = calculateDistance(
        pickup.latitude,
        pickup.longitude,
        delivery.latitude,
        delivery.longitude
      );

      sendSuccess(res, {
        ...estimate,
        distance: Math.round(distance * 100) / 100,
        trafficMultiplier,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get optimized route for driver's active orders
 * GET /api/v1/deliveries/route/my-route
 */
router.get('/route/my-route', authenticate, requireDriver, async (req, res, next) => {
  try {
    // Get driver info
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, current_latitude, current_longitude, vehicle_type')
      .eq('user_id', req.user!.id)
      .single();

    if (!driver) {
      throw ApiError.forbidden('Driver profile not found');
    }

    if (!driver.current_latitude || !driver.current_longitude) {
      throw new ApiError(400, 'LOCATION_REQUIRED', 'Please enable location to get route');
    }

    // Get driver's active orders
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        delivery_latitude,
        delivery_longitude,
        delivery_address_snapshot,
        pickup_latitude,
        pickup_longitude,
        pickup_address_snapshot,
        merchant:merchants (business_name),
        customer:users!orders_customer_id_fkey (first_name, last_name)
      `)
      .eq('driver_id', driver.id)
      .in('status', ['driver_assigned', 'picked_up', 'in_transit', 'arrived'])
      .order('created_at', { ascending: true });

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    if (!orders || orders.length === 0) {
      sendSuccess(res, {
        message: 'No active orders',
        route: null,
      });
      return;
    }

    // Build locations array from orders
    interface LocationData {
      id: string;
      latitude: number;
      longitude: number;
      type: 'pickup' | 'delivery';
      orderId: string;
      address: string;
      estimatedTime: number;
    }

    const locations: LocationData[] = [];

    for (const order of orders) {
      // Add pickup location if not yet picked up
      if (['driver_assigned'].includes(order.status)) {
        locations.push({
          id: `pickup-${order.id}`,
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude,
          type: 'pickup',
          orderId: order.id,
          address: (order.pickup_address_snapshot as Record<string, string>)?.address_line_1 || '',
          estimatedTime: 5,
        });
      }

      // Add delivery location
      locations.push({
        id: `delivery-${order.id}`,
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        type: 'delivery',
        orderId: order.id,
        address: (order.delivery_address_snapshot as Record<string, string>)?.address_line_1 || '',
        estimatedTime: 5,
      });
    }

    // Optimize route
    const driverLocation = {
      latitude: driver.current_latitude,
      longitude: driver.current_longitude,
    };

    const optimizedRoute = optimizeRoute(driverLocation, locations, {
      vehicleType: driver.vehicle_type || 'motorcycle',
      startTime: new Date(),
      respectPickupDeliveryOrder: true,
    });

    // Enrich stops with order details
    const enrichedStops = optimizedRoute.stops.map((stop) => {
      const order = orders.find((o) => o.id === stop.location.orderId);
      return {
        ...stop,
        orderNumber: order?.order_number,
        merchantName: (order?.merchant as Record<string, string>)?.business_name,
        customerName: order?.customer
          ? `${(order.customer as Record<string, string>).first_name} ${(order.customer as Record<string, string>).last_name}`
          : null,
      };
    });

    sendSuccess(res, {
      driverLocation,
      stops: enrichedStops,
      totalDistance: optimizedRoute.totalDistance,
      totalDuration: optimizedRoute.totalDuration,
      savings: optimizedRoute.savings,
      orderCount: orders.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
