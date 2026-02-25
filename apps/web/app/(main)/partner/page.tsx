'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users,
  BarChart3,
  Zap,
  Headphones,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const benefits = [
  {
    icon: Users,
    title: 'Reach More Customers',
    desc: 'Get discovered by thousands of customers in your area looking for what you offer.',
  },
  {
    icon: BarChart3,
    title: 'Easy Dashboard',
    desc: 'Manage orders, menu, and analytics from a simple merchant dashboard.',
  },
  {
    icon: Zap,
    title: 'Fast Payouts',
    desc: 'Receive your earnings directly to your bank account with weekly settlements.',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    desc: 'Our dedicated partner support team is always available to help you grow.',
  },
];

export default function PartnerPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    business_name: '',
    phone: '',
    business_type: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast({ title: 'Thank you! We\'ll be in touch soon.' });
  };

  return (
    <div className="pb-12">
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-16">
        <div className="container">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Grow your business with LMA
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Join our platform and reach thousands of customers in your area.
              We handle delivery so you can focus on what you do best.
            </p>
            <a href="#partner-form">
              <Button size="lg">Get Started</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why partner with us?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <Card key={b.title}>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="partner-form" className="py-12 bg-muted/30">
        <div className="container max-w-lg">
          <h2 className="text-2xl font-bold text-center mb-2">
            Interested? Let&apos;s talk
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Fill in your details and our team will reach out to you
          </p>

          {submitted ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Application Received!</h3>
                <p className="text-sm text-muted-foreground">
                  Thank you for your interest. Our partnerships team will contact you within 2-3 business days.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name *</Label>
                    <Input
                      id="business_name"
                      placeholder="Your business name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business_type">Business Type *</Label>
                    <select
                      id="business_type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.business_type}
                      onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                      required
                    >
                      <option value="">Select type</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="grocery">Grocery Store</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="retail">Retail Store</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full">
                    Submit Application
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
