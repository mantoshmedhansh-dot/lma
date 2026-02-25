'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  Mail,
  Phone,
  Package,
  CreditCard,
  User,
  Truck,
} from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

const faqSections: { title: string; icon: React.ElementType; items: FAQItem[] }[] = [
  {
    title: 'Orders',
    icon: Package,
    items: [
      {
        q: 'How do I place an order?',
        a: 'Browse merchants, add items to your cart, proceed to checkout, select your delivery address and payment method, then confirm your order.',
      },
      {
        q: 'Can I cancel my order?',
        a: 'You can cancel an order before the merchant starts preparing it. Go to Orders, select the order, and tap Cancel if the option is available.',
      },
      {
        q: 'How do I track my order?',
        a: 'Go to Orders and select your active order. You\'ll see real-time status updates from preparation to delivery.',
      },
      {
        q: 'What if my order is incorrect or damaged?',
        a: 'Contact us through the Help section within 24 hours of delivery. We\'ll review and process a refund or replacement.',
      },
    ],
  },
  {
    title: 'Payments',
    icon: CreditCard,
    items: [
      {
        q: 'What payment methods are accepted?',
        a: 'We accept credit/debit cards (Visa, Mastercard, RuPay), UPI, and cash on delivery.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. All card payments are processed through Stripe with industry-standard encryption. We never store your full card details.',
      },
      {
        q: 'How do I get a refund?',
        a: 'Refunds are processed to your original payment method within 5-7 business days. Cash on delivery refunds are credited to your wallet.',
      },
    ],
  },
  {
    title: 'Account',
    icon: User,
    items: [
      {
        q: 'How do I update my profile?',
        a: 'Go to Profile > Personal Information to update your name, phone number, and other details.',
      },
      {
        q: 'How do I change my password?',
        a: 'Use the "Forgot Password" option on the login page. We\'ll send a reset link to your registered email.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Contact our support team via email. Account deletion is permanent and cannot be reversed.',
      },
    ],
  },
  {
    title: 'Delivery',
    icon: Truck,
    items: [
      {
        q: 'What are the delivery charges?',
        a: 'Delivery charges vary based on distance and merchant. Orders above a certain amount may qualify for free delivery.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Delivery times depend on the merchant\'s preparation time and distance. Estimated times are shown before you place your order.',
      },
      {
        q: 'Can I schedule a delivery?',
        a: 'Scheduled deliveries are coming soon. Currently, all orders are delivered as soon as possible after placing.',
      },
    ],
  },
];

function Accordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        className="flex w-full items-center justify-between py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium pr-4">{item.q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <p className="pb-3 text-sm text-muted-foreground">{item.a}</p>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Help Center</h1>
      </div>

      {/* FAQ Sections */}
      {faqSections.map((section) => (
        <Card key={section.title} className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <section.icon className="h-5 w-5" />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {section.items.map((item) => (
              <Accordion key={item.q} item={item} />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Still need help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Our support team is available to help you with any issues.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:support@lma.app"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              support@lma.app
            </a>
            <a
              href="tel:+911800123456"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              1800-123-456 (Toll Free)
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
