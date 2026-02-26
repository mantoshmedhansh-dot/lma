'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, XCircle, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ImportRecord {
  id: string;
  file_name: string | null;
  total_records: number;
  processed: number;
  failed: number;
  status: string;
  created_at: string;
  error_log: Array<{ row: number; error: string }> | null;
}

export default function ImportOrdersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    import_id: string;
    total_records: number;
    processed: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [hubId, setHubId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get hub ID
      const { data: hub } = await supabase
        .from('hubs')
        .select('id')
        .eq('manager_id', session.user.id)
        .limit(1)
        .single();

      if (hub) {
        setHubId(hub.id);
      } else {
        // Admin - get first hub
        const { data: hubs } = await supabase
          .from('hubs')
          .select('id')
          .limit(1)
          .single();
        if (hubs) setHubId(hubs.id);
      }

      // Fetch import history
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hub-orders/imports`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) setImports(await res.json());
      } catch (err) {
        console.error('Failed to fetch imports:', err);
      }
    }
    init();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !hubId) return;
    setUploading(true);
    setResult(null);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hub-orders/upload-csv?hub_id=${hubId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setFile(null);
        // Refresh imports
        const importsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hub-orders/imports`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (importsRes.ok) setImports(await importsRes.json());
      } else {
        const err = await res.json();
        alert(err.detail || 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed: ' + (err as Error).message);
    }
    setUploading(false);
  }, [file, hubId]);

  const csvTemplate = `customer_name,customer_phone,delivery_address,product_description,city,state,pincode,weight,is_cod,cod_amount,priority,seller_name,marketplace,sku,category
"John Doe","9876543210","123 Main St, Sector 5","Samsung Washing Machine WA65A4002","Delhi","Delhi","110001","45","true","25000","normal","Samsung India","amazon","WA65A4002","washing_machine"`;

  return (
    <div>
      <DashboardHeader
        title="Import Orders"
        subtitle="Upload CSV to bulk create delivery orders"
        actions={
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('csv-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && f.name.endsWith('.csv')) setFile(f);
              }}
            >
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 font-medium">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">Supports .csv files</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? 'Uploading...' : 'Upload & Import'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([csvTemplate], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'delivery_orders_template.csv';
                  a.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upload Result */}
        {result && (
          <Card className={result.failed > 0 ? 'border-orange-200' : 'border-green-200'}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {result.failed === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-orange-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    Import {result.failed === 0 ? 'Completed Successfully' : 'Completed with Errors'}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>Total: {result.total_records}</span>
                    <span className="text-green-600">Processed: {result.processed}</span>
                    {result.failed > 0 && <span className="text-red-600">Failed: {result.failed}</span>}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3 rounded border bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-700">
                          Row {err.row}: {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No imports yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">File</th>
                    <th className="px-3 py-2 text-left font-medium">Total</th>
                    <th className="px-3 py-2 text-left font-medium">Processed</th>
                    <th className="px-3 py-2 text-left font-medium">Failed</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} className="border-b">
                      <td className="px-3 py-2">{imp.file_name || '-'}</td>
                      <td className="px-3 py-2">{imp.total_records}</td>
                      <td className="px-3 py-2 text-green-600">{imp.processed}</td>
                      <td className="px-3 py-2 text-red-600">{imp.failed}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          imp.status === 'completed' ? 'bg-green-100 text-green-800' :
                          imp.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {imp.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(imp.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
