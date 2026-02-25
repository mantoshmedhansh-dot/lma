import { Card, CardContent } from '@/components/ui/card';
import { Zap, Heart, Shield, Globe } from 'lucide-react';

export const metadata = {
  title: 'About Us | LMA',
  description: 'Learn about LMA and our mission to transform last-mile delivery.',
};

const stats = [
  { label: 'Merchants', value: '500+' },
  { label: 'Deliveries', value: '50,000+' },
  { label: 'Cities', value: '10+' },
  { label: 'Happy Customers', value: '25,000+' },
];

const values = [
  {
    icon: Zap,
    title: 'Speed',
    desc: 'We believe fast delivery transforms the customer experience. Every minute matters.',
  },
  {
    icon: Heart,
    title: 'Care',
    desc: 'We treat every order with care, ensuring quality from merchant to doorstep.',
  },
  {
    icon: Shield,
    title: 'Trust',
    desc: 'Transparent pricing, real-time tracking, and secure payments build lasting trust.',
  },
  {
    icon: Globe,
    title: 'Community',
    desc: 'We empower local businesses to thrive by connecting them with their community.',
  },
];

export default function AboutPage() {
  return (
    <div className="pb-12">
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-16">
        <div className="container max-w-3xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">About LMA</h1>
          <p className="text-lg text-muted-foreground">
            Connecting local businesses with customers through fast, reliable last-mile delivery.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-12">
        <div className="container max-w-3xl">
          <h2 className="text-2xl font-bold mb-4">Our Story</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              LMA was born from a simple observation: local businesses offer incredible products
              and services, but often lack the logistics to deliver them efficiently to customers&apos; doorsteps.
            </p>
            <p>
              We set out to build a platform that bridges this gap — giving merchants the tools to
              manage their online presence and fulfill orders, while providing customers with a
              seamless ordering experience with real-time tracking and reliable delivery.
            </p>
            <p>
              Today, LMA powers deliveries for hundreds of restaurants, grocery stores, pharmacies,
              and retail shops, helping them grow their business while delighting customers with
              fast and dependable service.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-8">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <Card key={v.title}>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <v.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-12 bg-muted/30">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-lg text-muted-foreground">
            To empower every local business with world-class delivery infrastructure,
            making it easy for customers to discover and receive what they love — quickly,
            reliably, and affordably.
          </p>
        </div>
      </section>
    </div>
  );
}
