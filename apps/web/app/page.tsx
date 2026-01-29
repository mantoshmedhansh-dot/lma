import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, ShieldCheck, Smartphone } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-primary">LMA</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Delivery at your
              <span className="text-primary"> doorstep</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Order from your favorite restaurants and stores. Get everything delivered fast and fresh to your doorstep.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/explore">
                <Button size="lg" className="h-12 px-8">
                  Start Ordering
                </Button>
              </Link>
              <Link href="/partner">
                <Button variant="outline" size="lg" className="h-12 px-8">
                  Become a Partner
                </Button>
              </Link>
            </div>
          </div>

          {/* Location Input */}
          <div className="mx-auto mt-16 max-w-xl">
            <div className="flex items-center gap-2 rounded-full border bg-background p-2 shadow-lg">
              <div className="flex items-center gap-2 pl-4">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <input
                type="text"
                placeholder="Enter your delivery address"
                className="flex-1 border-0 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button className="rounded-full">
                Find Food
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/50 py-20">
        <div className="container">
          <h2 className="text-center text-3xl font-bold">Why Choose LMA?</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Clock className="h-8 w-8" />}
              title="Fast Delivery"
              description="Get your orders delivered in minutes, not hours. Real-time tracking included."
            />
            <FeatureCard
              icon={<MapPin className="h-8 w-8" />}
              title="Wide Coverage"
              description="Thousands of restaurants and stores in your area, all in one app."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8" />}
              title="Safe & Secure"
              description="Contactless delivery and secure payments for your peace of mind."
            />
            <FeatureCard
              icon={<Smartphone className="h-8 w-8" />}
              title="Easy to Use"
              description="Simple and intuitive app experience on web and mobile."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="rounded-2xl bg-primary p-8 text-center text-primary-foreground sm:p-16">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to get started?</h2>
            <p className="mt-4 text-lg opacity-90">
              Download our app or start ordering from the web.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Download iOS App
              </Button>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Download Android App
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="text-lg font-semibold">LMA</h3>
              <p className="mt-4 text-sm text-muted-foreground">
                Your favorite local stores, delivered fast.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Company</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
                <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Support</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help" className="hover:text-foreground">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact Us</Link></li>
                <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Legal</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} LMA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
