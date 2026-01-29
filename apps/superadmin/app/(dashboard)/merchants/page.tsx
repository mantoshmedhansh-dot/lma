'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Search,
  Store,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Star,
  Eye,
} from 'lucide-react';

interface Merchant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  owner_id: string;
  contact_email: string;
  contact_phone: string;
  rating: number;
  total_reviews: number;
  commission_rate: number;
  is_featured: boolean;
  created_at: string;
  address: {
    city: string;
    state: string;
  };
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMerchants(data || []);
    } catch (error) {
      console.error('Error fetching merchants:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMerchantStatus = async (merchantId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ status })
        .eq('id', merchantId);

      if (error) throw error;
      fetchMerchants();
      setSelectedMerchant(null);
    } catch (error) {
      console.error('Error updating merchant:', error);
    }
  };

  const toggleFeatured = async (merchantId: string, isFeatured: boolean) => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ is_featured: !isFeatured })
        .eq('id', merchantId);

      if (error) throw error;
      fetchMerchants();
    } catch (error) {
      console.error('Error updating merchant:', error);
    }
  };

  const filteredMerchants = merchants.filter((merchant) => {
    const matchesSearch =
      merchant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || merchant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    active: 'success',
    pending: 'warning',
    suspended: 'destructive',
    closed: 'secondary',
  };

  const pendingCount = merchants.filter((m) => m.status === 'pending').length;

  return (
    <div>
      <Header title="Merchants" description="Manage merchant accounts and approvals" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{merchants.length}</p>
                </div>
                <Store className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className={pendingCount > 0 ? 'border-warning' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">
                    {merchants.filter((m) => m.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Featured</p>
                  <p className="text-2xl font-bold">
                    {merchants.filter((m) => m.is_featured).length}
                  </p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search merchants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </select>
          <Button variant="outline" onClick={fetchMerchants}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredMerchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No merchants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMerchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Store className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {merchant.name}
                            {merchant.is_featured && (
                              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {merchant.address?.city}, {merchant.address?.state}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{merchant.type}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[merchant.status] || 'secondary'}>
                        {merchant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {merchant.rating?.toFixed(1) || '0.0'}
                        <span className="text-muted-foreground text-xs">
                          ({merchant.total_reviews || 0})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{merchant.commission_rate}%</TableCell>
                    <TableCell>{formatDate(merchant.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {merchant.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMerchantStatus(merchant.id, 'active')}
                            >
                              <CheckCircle className="w-4 h-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMerchantStatus(merchant.id, 'suspended')}
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMerchant(merchant)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Merchant Detail Modal */}
      {selectedMerchant && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedMerchant(null)}
        >
          <div
            className="bg-card rounded-lg border max-w-lg w-full max-h-[80vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedMerchant.name}</h2>
              <Badge variant={statusColors[selectedMerchant.status]}>
                {selectedMerchant.status}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedMerchant.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Commission</p>
                  <p className="font-medium">{selectedMerchant.commission_rate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedMerchant.contact_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedMerchant.contact_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-medium">
                    {selectedMerchant.rating?.toFixed(1)} ({selectedMerchant.total_reviews} reviews)
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Featured</p>
                  <p className="font-medium">{selectedMerchant.is_featured ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedMerchant.status === 'pending' && (
                  <Button
                    className="flex-1"
                    onClick={() => updateMerchantStatus(selectedMerchant.id, 'active')}
                  >
                    Approve
                  </Button>
                )}
                {selectedMerchant.status === 'active' && (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => updateMerchantStatus(selectedMerchant.id, 'suspended')}
                  >
                    Suspend
                  </Button>
                )}
                {selectedMerchant.status === 'suspended' && (
                  <Button
                    className="flex-1"
                    onClick={() => updateMerchantStatus(selectedMerchant.id, 'active')}
                  >
                    Reactivate
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => toggleFeatured(selectedMerchant.id, selectedMerchant.is_featured)}
                >
                  {selectedMerchant.is_featured ? 'Remove Featured' : 'Make Featured'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
