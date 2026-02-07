from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
import re

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.merchant import (
    MerchantCreate,
    MerchantUpdate,
    MerchantResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductCategoryBase,
    ProductCategoryResponse,
)

router = APIRouter(prefix="/merchants", tags=["Merchants"])


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a name."""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


@router.get("/", response_model=List[MerchantResponse])
async def list_merchants(
    city: Optional[str] = None,
    merchant_type: Optional[str] = None,
    is_featured: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
):
    """List all active merchants with optional filters."""
    supabase = get_supabase()

    query = supabase.table("merchants").select("*").eq("status", "active")

    if city:
        query = query.ilike("city", f"%{city}%")
    if merchant_type:
        query = query.eq("merchant_type", merchant_type)
    if is_featured is not None:
        query = query.eq("is_featured", is_featured)
    if search:
        query = query.ilike("business_name", f"%{search}%")

    query = query.range(offset, offset + limit - 1).order("created_at", desc=True)

    result = query.execute()
    return [MerchantResponse(**m) for m in result.data]


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: str):
    """Get a specific merchant by ID."""
    supabase = get_supabase()

    result = supabase.table("merchants").select("*").eq("id", merchant_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchant not found"
        )

    return MerchantResponse(**result.data)


@router.get("/slug/{slug}", response_model=MerchantResponse)
async def get_merchant_by_slug(slug: str):
    """Get a merchant by slug."""
    supabase = get_supabase()

    result = supabase.table("merchants").select("*").eq("slug", slug).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchant not found"
        )

    return MerchantResponse(**result.data)


@router.post("/", response_model=MerchantResponse, status_code=status.HTTP_201_CREATED)
async def create_merchant(
    merchant_data: MerchantCreate,
    current_user: Dict = Depends(require_role(["merchant", "admin", "super_admin"]))
):
    """Create a new merchant profile."""
    supabase = get_supabase()

    # Generate slug
    slug = generate_slug(merchant_data.business_name)

    # Check if slug exists
    existing = supabase.table("merchants").select("id").eq("slug", slug).execute()
    if existing.data:
        slug = f"{slug}-{current_user['id'][:8]}"

    merchant = {
        **merchant_data.model_dump(),
        "user_id": current_user["id"],
        "slug": slug,
        "status": "pending",
    }

    result = supabase.table("merchants").insert(merchant).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create merchant"
        )

    return MerchantResponse(**result.data[0])


@router.patch("/{merchant_id}", response_model=MerchantResponse)
async def update_merchant(
    merchant_id: str,
    merchant_data: MerchantUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update a merchant profile."""
    supabase = get_supabase()

    # Verify ownership or admin
    merchant = supabase.table("merchants").select("user_id").eq("id", merchant_id).single().execute()

    if not merchant.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    if merchant.data["user_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = merchant_data.model_dump(exclude_unset=True)

    result = supabase.table("merchants").update(update_data).eq("id", merchant_id).execute()

    return MerchantResponse(**result.data[0])


# Products
@router.get("/{merchant_id}/products", response_model=List[ProductResponse])
async def list_merchant_products(
    merchant_id: str,
    category_id: Optional[str] = None,
    is_available: Optional[bool] = True,
    search: Optional[str] = None,
):
    """List products for a merchant."""
    supabase = get_supabase()

    query = supabase.table("products").select("*").eq("merchant_id", merchant_id)

    if category_id:
        query = query.eq("category_id", category_id)
    if is_available is not None:
        query = query.eq("is_available", is_available)
    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("display_order").order("name")

    result = query.execute()
    return [ProductResponse(**p) for p in result.data]


@router.post("/{merchant_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    merchant_id: str,
    product_data: ProductCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new product for a merchant."""
    supabase = get_supabase()

    # Verify ownership
    merchant = supabase.table("merchants").select("user_id").eq("id", merchant_id).single().execute()

    if not merchant.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    if merchant.data["user_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    product = {
        **product_data.model_dump(),
        "merchant_id": merchant_id,
    }

    result = supabase.table("products").insert(product).execute()

    return ProductResponse(**result.data[0])


@router.patch("/{merchant_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(
    merchant_id: str,
    product_id: str,
    product_data: ProductUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update a product."""
    supabase = get_supabase()

    # Verify ownership
    merchant = supabase.table("merchants").select("user_id").eq("id", merchant_id).single().execute()

    if not merchant.data or (merchant.data["user_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = product_data.model_dump(exclude_unset=True)

    result = supabase.table("products").update(update_data).eq("id", product_id).eq("merchant_id", merchant_id).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return ProductResponse(**result.data[0])


@router.delete("/{merchant_id}/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    merchant_id: str,
    product_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a product."""
    supabase = get_supabase()

    # Verify ownership
    merchant = supabase.table("merchants").select("user_id").eq("id", merchant_id).single().execute()

    if not merchant.data or (merchant.data["user_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    supabase.table("products").delete().eq("id", product_id).eq("merchant_id", merchant_id).execute()


# Product Categories
@router.get("/{merchant_id}/categories", response_model=List[ProductCategoryResponse])
async def list_product_categories(merchant_id: str):
    """List product categories for a merchant."""
    supabase = get_supabase()

    result = supabase.table("product_categories").select("*").eq(
        "merchant_id", merchant_id
    ).eq("is_active", True).order("display_order").execute()

    return [ProductCategoryResponse(**c) for c in result.data]


@router.post("/{merchant_id}/categories", response_model=ProductCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_product_category(
    merchant_id: str,
    category_data: ProductCategoryBase,
    current_user: Dict = Depends(get_current_user)
):
    """Create a product category."""
    supabase = get_supabase()

    # Verify ownership
    merchant = supabase.table("merchants").select("user_id").eq("id", merchant_id).single().execute()

    if not merchant.data or (merchant.data["user_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    category = {
        **category_data.model_dump(),
        "merchant_id": merchant_id,
    }

    result = supabase.table("product_categories").insert(category).execute()

    return ProductCategoryResponse(**result.data[0])
