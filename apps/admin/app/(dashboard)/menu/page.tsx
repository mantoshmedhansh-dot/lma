'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  DollarSign,
  Tag,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number | null;
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    image_url: '',
    category_id: '',
    is_available: true,
    is_featured: false,
    preparation_time: '15',
  });

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!merchant) return;
      setMerchantId(merchant.id);

      const [categoriesRes, productsRes] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('merchant_id', merchant.id)
          .order('sort_order'),
        supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchant.id)
          .order('name'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load menu data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!merchantId || !categoryForm.name) return;

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryForm.name,
            description: categoryForm.description || null,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast({ title: 'Category updated' });
      } else {
        const { error } = await supabase.from('categories').insert({
          merchant_id: merchantId,
          name: categoryForm.name,
          description: categoryForm.description || null,
          sort_order: categories.length,
        });

        if (error) throw error;
        toast({ title: 'Category created' });
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save category',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Products in this category will become uncategorized.')) return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Category deleted' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
    }
  };

  // Product CRUD
  const handleSaveProduct = async () => {
    if (!merchantId || !productForm.name || !productForm.price) return;

    try {
      const productData = {
        merchant_id: merchantId,
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        compare_at_price: productForm.compare_at_price
          ? parseFloat(productForm.compare_at_price)
          : null,
        image_url: productForm.image_url || null,
        category_id: productForm.category_id || null,
        is_available: productForm.is_available,
        is_featured: productForm.is_featured,
        preparation_time: productForm.preparation_time
          ? parseInt(productForm.preparation_time)
          : null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Product updated' });
      } else {
        const { error } = await supabase.from('products').insert(productData);
        if (error) throw error;
        toast({ title: 'Product created' });
      }

      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: '',
        compare_at_price: '',
        image_url: '',
        category_id: '',
        is_available: true,
        is_featured: false,
        preparation_time: '15',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save product',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Product deleted' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  const toggleProductAvailability = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update availability',
        variant: 'destructive',
      });
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find((c) => c.id === categoryId)?.name || 'Uncategorized';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="text-muted-foreground">
            {products.length} products in {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '' });
              setShowCategoryModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Category
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setProductForm({
                name: '',
                description: '',
                price: '',
                compare_at_price: '',
                image_url: '',
                category_id: categories[0]?.id || '',
                is_available: true,
                is_featured: false,
                preparation_time: '15',
              });
              setShowProductModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Product
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-1 bg-card border rounded-lg px-3 py-2 min-w-fit"
          >
            <span className="text-sm font-medium">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              ({products.filter((p) => p.category_id === category.id).length})
            </span>
            <button
              onClick={() => {
                setEditingCategory(category);
                setCategoryForm({
                  name: category.name,
                  description: category.description || '',
                });
                setShowCategoryModal(true);
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-12 bg-card rounded-lg border">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first product to get started'}
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-card rounded-lg border overflow-hidden ${
                !product.is_available ? 'opacity-60' : ''
              }`}
            >
              <div className="aspect-video bg-muted flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {getCategoryName(product.category_id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{product.price.toFixed(2)}</p>
                    {product.compare_at_price && (
                      <p className="text-xs text-muted-foreground line-through">
                        ₹{product.compare_at_price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => toggleProductAvailability(product)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      product.is_available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </button>
                  {product.is_featured && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Featured
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setProductForm({
                          name: product.name,
                          description: product.description || '',
                          price: product.price.toString(),
                          compare_at_price: product.compare_at_price?.toString() || '',
                          image_url: product.image_url || '',
                          category_id: product.category_id || '',
                          is_available: product.is_available,
                          is_featured: product.is_featured,
                          preparation_time: product.preparation_time?.toString() || '15',
                        });
                        setShowProductModal(true);
                      }}
                      className="p-2 hover:bg-muted rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="bg-card rounded-lg border max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  placeholder="e.g., Main Dishes"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSaveCategory}>
                  {editingCategory ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowProductModal(false)}
        >
          <div
            className="bg-card rounded-lg border max-w-lg w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  placeholder="Product name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  placeholder="Product description"
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price *</label>
                  <Input
                    type="number"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, price: e.target.value })
                    }
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Compare at Price</label>
                  <Input
                    type="number"
                    value={productForm.compare_at_price}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        compare_at_price: e.target.value,
                      })
                    }
                    placeholder="Original price"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={productForm.category_id}
                  onChange={(e) =>
                    setProductForm({ ...productForm, category_id: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Image URL</label>
                <Input
                  value={productForm.image_url}
                  onChange={(e) =>
                    setProductForm({ ...productForm, image_url: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Preparation Time (minutes)</label>
                <Input
                  type="number"
                  value={productForm.preparation_time}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      preparation_time: e.target.value,
                    })
                  }
                  placeholder="15"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productForm.is_available}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        is_available: e.target.checked,
                      })
                    }
                    className="rounded border-input"
                  />
                  <span className="text-sm">Available</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productForm.is_featured}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        is_featured: e.target.checked,
                      })
                    }
                    className="rounded border-input"
                  />
                  <span className="text-sm">Featured</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSaveProduct}>
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
