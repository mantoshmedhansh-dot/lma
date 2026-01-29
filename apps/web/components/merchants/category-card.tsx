import Link from 'next/link';

interface CategoryCardProps {
  name: string;
  slug: string;
  icon: string;
  color: string;
}

export function CategoryCard({ name, slug, icon, color }: CategoryCardProps) {
  return (
    <Link href={`/merchants?type=${slug}`}>
      <div className={`${color} rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl group-hover:scale-110 transition-transform">
            {icon}
          </span>
          <span className="font-medium group-hover:text-primary transition-colors">
            {name}
          </span>
        </div>
      </div>
    </Link>
  );
}
