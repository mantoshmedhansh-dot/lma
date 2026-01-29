import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated } from '../utils/response.js';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ERROR_CODES,
  CANCELLABLE_ORDER_STATUSES,
  calculateOrderTotals,
  calculateDeliveryFee,
} from '@lma/shared';

const router = Router();

// Validation schemas
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid order ID'),
});

const createOrderSchema = z.object({
  merchant_id: z.string().uuid('Invalid merchant ID'),
  items: z.array(z.object({
    product_id: z.string().uuid('Invalid product ID'),
    variant_id: z.string().uuid().optional(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    addons: z.array(z.object({
      addon_id: z.string().uuid('Invalid addon ID'),
      quantity: z.number().min(1).default(1),
    })).optional(),
    special_instructions: z.string().optional(),
  })).min(1, 'At least one item is required'),
  delivery_address_id: z.string().uuid('Invalid address ID'),
  payment_method: z.enum(['card', 'wallet', 'cash', 'upi', 'net_banking']),
  coupon_code: z.string().optional(),
  tip_amount: z.number().min(0).default(0),
  customer_notes: z.string().optional(),
  scheduled_for: z.string().datetime().optional(),
});

/**
 * Get user's orders
 * GET /api/v1/orders
 */
router.get('/', authenticate, requireCustomer, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, status, from_date, to_date } = req.query as z.infer<typeof listQuerySchema>;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        created_at,
        delivered_at,
        merchants (
          id,
          business_name,
          logo_url
        ),
        order_items (count)
      `, { count: 'exact' })
      .eq('customer_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (from_date) {
      query = query.gte('created_at', from_date);
    }

    if (to_date) {
      query = query.lte('created_at', to_date);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: orders, count, error } = await query;

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    // Transform response
    const transformedOrders = orders?.map((order: Record<string, unknown>) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      delivered_at: order.delivered_at,
      merchant: order.merchants,
      items_count: (order.order_items as Array<{ count: number }>)?.[0]?.count || 0,
    }));

    sendPaginated(res, transformedOrders || [], {
      page,
      limit,
      total: count || 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get order by ID
 * GET /api/v1/orders/:id
 */
router.get('/:id', authenticate, validateParams(idParamSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        merchants (
          id,
          business_name,
          logo_url,
          phone,
          address_line_1,
          city,
          latitude,
          longitude
        ),
        drivers (
          id,
          users (
            first_name,
            last_name,
            phone,
            avatar_url
          ),
          vehicle_type,
          vehicle_number,
          current_latitude,
          current_longitude,
          average_rating
        ),
        order_items (
          id,
          product_name,
          variant_name,
          unit_price,
          quantity,
          total_price,
          special_instructions,
          order_item_addons (
            addon_name,
            quantity,
            total_price
          )
        ),
        order_status_history (
          status,
          created_at,
          notes
        ),
        payments (
          payment_method,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      throw ApiError.notFound('Order not found');
    }

    // Check if user has access to this order
    const isCustomer = order.customer_id === req.user!.id;
    const isMerchant = req.user!.role === 'merchant'; // Would need to verify merchant_id
    const isDriver = order.driver_id && req.user!.role === 'driver'; // Would need to verify driver_id
    const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

    if (!isCustomer && !isMerchant && !isDriver && !isAdmin) {
      throw ApiError.forbidden('You do not have access to this order');
    }

    // Transform response
    const transformedOrder = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      merchant: {
        id: (order.merchants as Record<string, unknown>)?.id,
        business_name: (order.merchants as Record<string, unknown>)?.business_name,
        logo_url: (order.merchants as Record<string, unknown>)?.logo_url,
        phone: (order.merchants as Record<string, unknown>)?.phone,
        address: `${(order.merchants as Record<string, unknown>)?.address_line_1}, ${(order.merchants as Record<string, unknown>)?.city}`,
        latitude: (order.merchants as Record<string, unknown>)?.latitude,
        longitude: (order.merchants as Record<string, unknown>)?.longitude,
      },
      driver: order.drivers ? {
        id: (order.drivers as Record<string, unknown>)?.id,
        name: `${((order.drivers as Record<string, unknown>)?.users as Record<string, unknown>)?.first_name} ${((order.drivers as Record<string, unknown>)?.users as Record<string, unknown>)?.last_name}`,
        phone: ((order.drivers as Record<string, unknown>)?.users as Record<string, unknown>)?.phone,
        avatar_url: ((order.drivers as Record<string, unknown>)?.users as Record<string, unknown>)?.avatar_url,
        vehicle_type: (order.drivers as Record<string, unknown>)?.vehicle_type,
        vehicle_number: (order.drivers as Record<string, unknown>)?.vehicle_number,
        current_latitude: (order.drivers as Record<string, unknown>)?.current_latitude,
        current_longitude: (order.drivers as Record<string, unknown>)?.current_longitude,
        average_rating: (order.drivers as Record<string, unknown>)?.average_rating,
      } : null,
      delivery_address: {
        ...order.delivery_address_snapshot,
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
      },
      items: order.order_items,
      subtotal: order.subtotal,
      delivery_fee: order.delivery_fee,
      service_fee: order.service_fee,
      tax_amount: order.tax_amount,
      discount_amount: order.discount_amount,
      tip_amount: order.tip_amount,
      total_amount: order.total_amount,
      coupon_code: order.coupon_code,
      payment_method: (order.payments as Array<Record<string, unknown>>)?.[0]?.payment_method,
      payment_status: (order.payments as Array<Record<string, unknown>>)?.[0]?.status,
      estimated_delivery_time: order.estimated_delivery_time,
      scheduled_for: order.scheduled_for,
      customer_notes: order.customer_notes,
      status_history: order.order_status_history,
      created_at: order.created_at,
      confirmed_at: order.confirmed_at,
      picked_up_at: order.picked_up_at,
      delivered_at: order.delivered_at,
    };

    sendSuccess(res, transformedOrder);
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new order
 * POST /api/v1/orders
 */
router.post('/', authenticate, requireCustomer, validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const {
      merchant_id,
      items,
      delivery_address_id,
      payment_method,
      coupon_code,
      tip_amount,
      customer_notes,
      scheduled_for,
    } = req.body as z.infer<typeof createOrderSchema>;

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('*')
      .eq('id', merchant_id)
      .eq('status', 'active')
      .single();

    if (merchantError || !merchant) {
      throw new ApiError(400, ERROR_CODES.NOT_FOUND, 'Merchant not found or inactive');
    }

    // Get delivery address
    const { data: address, error: addressError } = await supabaseAdmin
      .from('addresses')
      .select('*')
      .eq('id', delivery_address_id)
      .eq('user_id', req.user!.id)
      .single();

    if (addressError || !address) {
      throw new ApiError(400, ERROR_CODES.NOT_FOUND, 'Delivery address not found');
    }

    // Get products with variants and addons
    const productIds = items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_variants (*),
        product_addons (*)
      `)
      .in('id', productIds)
      .eq('merchant_id', merchant_id)
      .eq('is_available', true);

    if (productsError || !products || products.length !== productIds.length) {
      throw new ApiError(400, ERROR_CODES.PRODUCT_UNAVAILABLE, 'One or more products are unavailable');
    }

    // Calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products.find((p: { id: string }) => p.id === item.product_id) as {
        id: string;
        name: string;
        price: number;
        product_variants?: Array<{ id: string; name: string; price_modifier: number }>;
        product_addons?: Array<{ id: string; name: string; price: number }>;
      };
      let unitPrice = product.price;
      let variantName = null;

      // Add variant price
      if (item.variant_id) {
        const variant = product.product_variants?.find((v: { id: string }) => v.id === item.variant_id);
        if (variant) {
          unitPrice += variant.price_modifier;
          variantName = variant.name;
        }
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      // Calculate addon totals
      const itemAddons = [];
      if (item.addons) {
        for (const addonItem of item.addons) {
          const addon = product.product_addons?.find((a: { id: string }) => a.id === addonItem.addon_id);
          if (addon) {
            const addonTotal = addon.price * addonItem.quantity;
            subtotal += addonTotal;
            itemAddons.push({
              addon_id: addon.id,
              addon_name: addon.name,
              quantity: addonItem.quantity,
              unit_price: addon.price,
              total_price: addonTotal,
            });
          }
        }
      }

      orderItems.push({
        product_id: product.id,
        variant_id: item.variant_id || null,
        product_name: product.name,
        variant_name: variantName,
        unit_price: unitPrice,
        quantity: item.quantity,
        total_price: itemTotal,
        special_instructions: item.special_instructions || null,
        addons: itemAddons,
      });
    }

    // Check minimum order amount
    if (subtotal < merchant.min_order_amount) {
      throw new ApiError(
        400,
        ERROR_CODES.BELOW_MINIMUM_ORDER,
        `Minimum order amount is ${merchant.min_order_amount}`
      );
    }

    // Calculate delivery fee (simplified - would use actual distance)
    const deliveryFee = calculateDeliveryFee(5); // Assuming 5km for now

    // Apply coupon if provided
    let discountAmount = 0;
    let couponId = null;
    if (coupon_code) {
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (coupon) {
        const now = new Date();
        const startsAt = new Date(coupon.starts_at);
        const expiresAt = new Date(coupon.expires_at);

        if (now >= startsAt && now <= expiresAt) {
          if (subtotal >= coupon.min_order_amount) {
            if (coupon.discount_type === 'percentage') {
              discountAmount = Math.round(subtotal * (coupon.discount_value / 100));
              if (coupon.max_discount_amount) {
                discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
              }
            } else {
              discountAmount = coupon.discount_value;
            }
            couponId = coupon.id;
          }
        }
      }
    }

    // Calculate totals
    const totals = calculateOrderTotals(subtotal, deliveryFee, discountAmount, tip_amount);

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: req.user!.id,
        merchant_id,
        status: 'pending',
        delivery_address_id,
        delivery_address_snapshot: {
          label: address.label,
          address_line_1: address.address_line_1,
          address_line_2: address.address_line_2,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
        },
        delivery_latitude: address.latitude,
        delivery_longitude: address.longitude,
        delivery_instructions: address.delivery_instructions,
        pickup_address_snapshot: {
          address_line_1: merchant.address_line_1,
          address_line_2: merchant.address_line_2,
          city: merchant.city,
          state: merchant.state,
          postal_code: merchant.postal_code,
          country: merchant.country,
        },
        pickup_latitude: merchant.latitude,
        pickup_longitude: merchant.longitude,
        subtotal: totals.subtotal,
        delivery_fee: totals.deliveryFee,
        service_fee: totals.serviceFee,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        tip_amount: totals.tipAmount,
        total_amount: totals.total,
        coupon_id: couponId,
        coupon_code: coupon_code || null,
        estimated_prep_time: merchant.estimated_prep_time,
        scheduled_for,
        customer_notes,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Failed to create order');
    }

    // Create order items
    for (const item of orderItems) {
      const { data: orderItem, error: itemError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_name: item.variant_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          total_price: item.total_price,
          special_instructions: item.special_instructions,
        })
        .select()
        .single();

      if (itemError) {
        // Rollback order on failure
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        throw new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Failed to create order items');
      }

      // Create order item addons
      if (item.addons.length > 0) {
        await supabaseAdmin.from('order_item_addons').insert(
          item.addons.map((addon) => ({
            order_item_id: orderItem.id,
            ...addon,
          }))
        );
      }
    }

    // Create initial status history
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      status: 'pending',
      changed_by: req.user!.id,
    });

    // Create payment record
    await supabaseAdmin.from('payments').insert({
      order_id: order.id,
      user_id: req.user!.id,
      amount: totals.total,
      payment_method,
      status: payment_method === 'cash' ? 'pending' : 'processing',
    });

    sendCreated(res, {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      payment_method,
      status: order.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel order
 * POST /api/v1/orders/:id/cancel
 */
router.post('/:id/cancel', authenticate, validateParams(idParamSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('customer_id', req.user!.id)
      .single();

    if (orderError || !order) {
      throw ApiError.notFound('Order not found');
    }

    // Check if order can be cancelled
    if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      throw new ApiError(
        400,
        ERROR_CODES.ORDER_CANNOT_BE_CANCELLED,
        'Order cannot be cancelled at this stage'
      );
    }

    // Update order status
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: req.user!.id,
        cancellation_reason: reason || 'Cancelled by customer',
      })
      .eq('id', id);

    if (updateError) {
      throw new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel order');
    }

    // Add to status history
    await supabaseAdmin.from('order_status_history').insert({
      order_id: id,
      status: 'cancelled',
      changed_by: req.user!.id,
      notes: reason || 'Cancelled by customer',
    });

    sendSuccess(res, { message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
