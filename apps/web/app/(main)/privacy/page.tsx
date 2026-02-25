export const metadata = {
  title: 'Privacy Policy | LMA',
  description: 'LMA Privacy Policy — learn how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

      <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            We collect information you provide directly, including your name, email address, phone number,
            delivery addresses, and payment information. We also collect usage data such as order history,
            search queries, and interaction with the app. Device information including browser type, IP
            address, and location data may be collected to improve our Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>
            Your information is used to process and deliver orders, communicate about your account and
            transactions, personalize your experience, improve our Service, send promotional offers
            (with your consent), prevent fraud and ensure security, and comply with legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Information Sharing</h2>
          <p>
            We share your information only as necessary: with merchants to fulfill your orders, with
            delivery partners to complete deliveries, with payment processors to handle transactions,
            and with service providers who assist our operations. We do not sell your personal information
            to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your data, including encryption
            of data in transit and at rest, secure authentication protocols, and regular security audits.
            However, no method of transmission over the Internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to maintain your session, remember preferences, and
            analyze usage patterns. You can control cookie preferences through your browser settings.
            Disabling cookies may affect certain features of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal data. You can update your
            information through your profile settings or contact us directly. You may opt out of
            promotional communications at any time. To request data deletion, contact our support team.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed to
            provide the Service. Order history and transaction records may be retained for legal and
            business purposes even after account deletion.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Children&apos;s Privacy</h2>
          <p>
            Our Service is not directed to individuals under 18. We do not knowingly collect personal
            information from children. If we become aware that a child has provided us with personal
            data, we will take steps to delete such information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            For privacy-related questions or requests, please contact us at{' '}
            <a href="mailto:privacy@lma.app" className="text-primary hover:underline">
              privacy@lma.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
