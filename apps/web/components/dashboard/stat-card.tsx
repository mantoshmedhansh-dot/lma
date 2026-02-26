interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, subtitle, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
