'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import {
  Search,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Star,
  Eye,
  User,
} from 'lucide-react';

interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  status: string;
  is_online: boolean;
  rating: number;
  total_deliveries: number;
  created_at: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDriverStatus = async (driverId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status })
        .eq('id', driverId);

      if (error) throw error;
      fetchDrivers();
      setSelectedDriver(null);
    } catch (error) {
      console.error('Error updating driver:', error);
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'secondary'> = {
    approved: 'success',
    pending: 'warning',
    suspended: 'destructive',
    online: 'success',
    offline: 'secondary',
    busy: 'info',
  };

  const pendingCount = drivers.filter((d) => d.status === 'pending').length;
  const onlineCount = drivers.filter((d) => d.is_online).length;

  return (
    <div>
      <Header title="Drivers" description="Manage delivery partners" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{drivers.length}</p>
                </div>
                <Truck className="w-8 h-8 text-muted-foreground" />
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
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">
                    {drivers.filter((d) => d.status === 'approved').length}
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
                  <p className="text-sm text-muted-foreground">Online Now</p>
                  <p className="text-2xl font-bold">{onlineCount}</p>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
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
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button variant="outline" onClick={fetchDrivers}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Deliveries</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No drivers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{driver.full_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="capitalize">{driver.vehicle_type}</p>
                        <p className="text-sm text-muted-foreground">{driver.vehicle_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[driver.status] || 'secondary'}>
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            driver.is_online ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        {driver.is_online ? 'Online' : 'Offline'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {driver.rating?.toFixed(1) || '0.0'}
                      </div>
                    </TableCell>
                    <TableCell>{driver.total_deliveries || 0}</TableCell>
                    <TableCell>{formatDate(driver.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {driver.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateDriverStatus(driver.id, 'approved')}
                            >
                              <CheckCircle className="w-4 h-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateDriverStatus(driver.id, 'suspended')}
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDriver(driver)}
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

      {/* Driver Detail Modal */}
      {selectedDriver && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDriver(null)}
        >
          <div
            className="bg-card rounded-lg border max-w-lg w-full max-h-[80vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedDriver.full_name}</h2>
              <Badge variant={statusColors[selectedDriver.status]}>
                {selectedDriver.status}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedDriver.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedDriver.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle Type</p>
                  <p className="font-medium capitalize">{selectedDriver.vehicle_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle Number</p>
                  <p className="font-medium">{selectedDriver.vehicle_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">License</p>
                  <p className="font-medium">{selectedDriver.license_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-medium">{selectedDriver.rating?.toFixed(1) || '0.0'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Deliveries</p>
                  <p className="font-medium">{selectedDriver.total_deliveries || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currently Online</p>
                  <p className="font-medium">{selectedDriver.is_online ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedDriver.status === 'pending' && (
                  <Button
                    className="flex-1"
                    onClick={() => updateDriverStatus(selectedDriver.id, 'approved')}
                  >
                    Approve
                  </Button>
                )}
                {selectedDriver.status === 'approved' && (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => updateDriverStatus(selectedDriver.id, 'suspended')}
                  >
                    Suspend
                  </Button>
                )}
                {selectedDriver.status === 'suspended' && (
                  <Button
                    className="flex-1"
                    onClick={() => updateDriverStatus(selectedDriver.id, 'approved')}
                  >
                    Reactivate
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedDriver(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
