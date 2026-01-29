import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@lma/shared';

const router = Router();

// Validation schemas
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  type: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  radius_km: z.coerce.number().default(10),
  is_open: z.enum(['true', 'false']).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  sort_by: z.enum(['rating', 'distance', 'name', 'delivery_time']).default('rating'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid merchant ID'),
});

const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

/**
 * Get list of merchants
 * GET /api/v1/merchants
 */
router.get('/', optionalAuth, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const {
      page,
      limit,
      type,
      category,
      city,
      search,
      latitude,
      longitude,
      radius_km,
      min_rating,
      sort_by,
      sort_order,
    } = req.query as z.infer<typeof listQuerySchema>;

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('merchants')
      .select(`
        id,
        business_name,
        slug,
        logo_url,
        cover_image_url,
        merchant_type,
        average_rating,
        total_ratings,
        estimated_prep_time,
        min_order_amount,
        delivery_radius_km,
        city,
        latitude,
        longitude,
        merchant_categories (
          categories (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .eq('status', 'active');

    // Apply filters
    if (type) {
      query = query.eq('merchant_type', type);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (min_rating) {
      query = query.gte('average_rating', min_rating);
    }

    // Sort
    const sortColumn = sort_by === 'delivery_time' ? 'estimated_prep_time' :
                       sort_by === 'rating' ? 'average_rating' :
                       sort_by === 'name' ? 'business_name' : 'average_rating';
    query = query.order(sortColumn, { ascending: sort_order === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: merchants, count, error } = await query;

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    // Transform response
    const transformedMerchants = merchants?.map((merchant: Record<string, unknown>) => ({
      ...merchant,
      categories: (merchant.merchant_categories as Array<{ categories: unknown }>)?.map((mc) => mc.categories) || [],
      merchant_categories: undefined,
      // Calculate if merchant is open (simplified - would need proper hours check)
      is_open: true,
    }));

    sendPaginated(res, transformedMerchants || [], {
      page,
      limit,
      total: count || 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get merchant by ID
 * GET /api/v1/merchants/:id
 */
router.get('/:id', optionalAuth, validateParams(idParamSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: merchant, error } = await supabaseAdmin
      .from('merchants')
      .select(`
        *,
        merchant_hours (*),
        merchant_categories (
          categories (
            id,
            name,
            slug
          )
        ),
        product_categories (
          id,
          name,
          description,
          display_order,
          products (
            id,
            name,
            description,
            image_url,
            price,
            compare_at_price,
            is_vegetarian,
            is_vegan,
            is_available,
            is_featured,
            display_order
          )
        )
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !merchant) {
      throw ApiError.notFound('Merchant not found');
    }

    // Transform response
    const transformedMerchant = {
      ...merchant,
      categories: merchant.merchant_categories?.map((mc: { categories: unknown }) => mc.categories) || [],
      hours: merchant.merchant_hours || [],
      product_categories: merchant.product_categories
        ?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
        .map((cat: { products: Array<{ is_available: boolean; display_order: number }>; [key: string]: unknown }) => ({
          ...cat,
          products: cat.products
            ?.filter((p: { is_available: boolean }) => p.is_available)
            .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) || [],
        })) || [],
      merchant_hours: undefined,
      merchant_categories: undefined,
      is_open: true, // Would need proper hours check
    };

    sendSuccess(res, transformedMerchant);
  } catch (error) {
    next(error);
  }
});

/**
 * Get merchant by slug
 * GET /api/v1/merchants/slug/:slug
 */
router.get('/slug/:slug', optionalAuth, validateParams(slugParamSchema), async (req, res, next) => {
  try {
    const { slug } = req.params;

    const { data: merchant, error } = await supabaseAdmin
      .from('merchants')
      .select(`
        *,
        merchant_hours (*),
        merchant_categories (
          categories (
            id,
            name,
            slug
          )
        ),
        product_categories (
          id,
          name,
          description,
          display_order,
          products (
            id,
            name,
            description,
            image_url,
            price,
            compare_at_price,
            is_vegetarian,
            is_vegan,
            is_available,
            is_featured,
            display_order
          )
        )
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !merchant) {
      throw ApiError.notFound('Merchant not found');
    }

    // Transform response (same as by ID)
    const transformedMerchant = {
      ...merchant,
      categories: merchant.merchant_categories?.map((mc: { categories: unknown }) => mc.categories) || [],
      hours: merchant.merchant_hours || [],
      product_categories: merchant.product_categories
        ?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
        .map((cat: { products: Array<{ is_available: boolean; display_order: number }>; [key: string]: unknown }) => ({
          ...cat,
          products: cat.products
            ?.filter((p: { is_available: boolean }) => p.is_available)
            .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) || [],
        })) || [],
      merchant_hours: undefined,
      merchant_categories: undefined,
      is_open: true,
    };

    sendSuccess(res, transformedMerchant);
  } catch (error) {
    next(error);
  }
});

/**
 * Get merchant products
 * GET /api/v1/merchants/:id/products
 */
router.get('/:id/products', optionalAuth, validateParams(idParamSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_variants (*),
        product_addons (*)
      `)
      .eq('merchant_id', id)
      .eq('is_available', true)
      .order('display_order');

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    sendSuccess(res, products || []);
  } catch (error) {
    next(error);
  }
});

export default router;
