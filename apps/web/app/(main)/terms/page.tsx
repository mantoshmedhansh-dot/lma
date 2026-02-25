export const metadata = {
  title: 'Terms of Service | LMA',
  description: 'LMA Terms of Service — read our terms and conditions.',
};

export default function TermsPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

      <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the LMA platform (&quot;Service&quot;), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use our Service. We reserve the
            right to update these terms at any time, and your continued use of the Service constitutes
            acceptance of any changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. User Accounts</h2>
          <p>
            To use certain features, you must create an account with accurate and complete information.
            You are responsible for maintaining the confidentiality of your account credentials and for
            all activities under your account. You must be at least 18 years old to create an account.
            Notify us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Orders and Transactions</h2>
          <p>
            When you place an order through LMA, you are making an offer to purchase products from a
            merchant. The merchant may accept or decline your order. Prices displayed include applicable
            taxes unless otherwise stated. Delivery fees and service charges are shown before you confirm
            your order.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Payments</h2>
          <p>
            Payments are processed securely through our third-party payment processor. By providing
            payment information, you authorize us to charge the specified amount. Refunds are subject
            to our refund policy and are processed to the original payment method within 5-7 business days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Cancellations and Refunds</h2>
          <p>
            You may cancel an order before the merchant begins preparation. Once preparation has started,
            cancellation may not be possible. Refund eligibility depends on the cancellation timing and
            reason. For quality issues or incorrect items, contact our support team within 24 hours of delivery.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Limitation of Liability</h2>
          <p>
            LMA acts as an intermediary between customers and merchants. We are not responsible for the
            quality, safety, or legality of products offered by merchants. Our liability is limited to
            the amount paid for the specific order in question. We do not guarantee delivery times, which
            are estimates only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Prohibited Conduct</h2>
          <p>
            You agree not to misuse the Service, including but not limited to: creating fake accounts,
            placing fraudulent orders, harassing delivery personnel or merchants, attempting to circumvent
            our systems, or using the Service for any unlawful purpose.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. Material changes will be communicated via email or
            an in-app notification. Your continued use of the Service after changes are posted constitutes
            acceptance of the modified terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            If you have questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:legal@lma.app" className="text-primary hover:underline">
              legal@lma.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
