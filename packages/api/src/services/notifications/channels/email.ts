/**
 * Email Notification Channel
 *
 * Handles email notifications via:
 * - SendGrid
 * - AWS SES
 * - SMTP fallback
 */

import { logger } from '../../../lib/logger.js';

interface EmailPayload {
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

interface EmailRecipient {
  userId?: string;
  email: string;
  name?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipient: EmailRecipient;
  provider: string;
}

type EmailProvider = 'sendgrid' | 'ses' | 'smtp' | 'mock';

interface ProviderConfig {
  sendgrid?: {
    apiKey: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  fromEmail: string;
  fromName: string;
}

class EmailNotificationChannel {
  private config: Partial<ProviderConfig> = {};
  private defaultProvider: EmailProvider = 'mock';

  /**
   * Initialize email providers
   */
  initialize(config: ProviderConfig, defaultProvider: EmailProvider = 'sendgrid'): void {
    this.config = config;
    this.defaultProvider = defaultProvider;
    logger.info('Email notification channel initialized', { provider: defaultProvider });
  }

  /**
   * Send email to a single recipient
   */
  async send(
    recipient: EmailRecipient,
    payload: EmailPayload,
    provider?: EmailProvider
  ): Promise<EmailResult> {
    const selectedProvider = provider || this.defaultProvider;

    try {
      let result: EmailResult;

      switch (selectedProvider) {
        case 'sendgrid':
          result = await this.sendViaSendGrid(recipient, payload);
          break;
        case 'ses':
          result = await this.sendViaSES(recipient, payload);
          break;
        case 'smtp':
          result = await this.sendViaSMTP(recipient, payload);
          break;
        default:
          result = await this.sendViaMock(recipient, payload);
      }

      if (result.success) {
        logger.info('Email sent successfully', {
          userId: recipient.userId,
          email: recipient.email,
          provider: selectedProvider,
          messageId: result.messageId,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send email', {
        email: recipient.email,
        provider: selectedProvider,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        recipient,
        provider: selectedProvider,
      };
    }
  }

  /**
   * Send email to multiple recipients
   */
  async sendBatch(
    recipients: EmailRecipient[],
    payload: EmailPayload,
    provider?: EmailProvider
  ): Promise<EmailResult[]> {
    // SendGrid supports batch sending, others need individual sends
    const results = await Promise.all(
      recipients.map((recipient) => this.send(recipient, payload, provider))
    );

    const successCount = results.filter((r) => r.success).length;
    logger.info('Batch email sent', {
      total: recipients.length,
      success: successCount,
      failed: recipients.length - successCount,
    });

    return results;
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(
    recipient: EmailRecipient,
    payload: EmailPayload
  ): Promise<EmailResult> {
    if (!this.config.sendgrid) {
      throw new Error('SendGrid not configured');
    }

    // In production, use SendGrid SDK:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(this.config.sendgrid.apiKey);
    //
    // const msg = {
    //   to: { email: recipient.email, name: recipient.name },
    //   from: { email: this.config.fromEmail, name: this.config.fromName },
    //   subject: payload.subject,
    //   text: payload.text,
    //   html: payload.html,
    //   templateId: payload.templateId,
    //   dynamicTemplateData: payload.templateData,
    //   attachments: payload.attachments,
    // };
    //
    // const [response] = await sgMail.send(msg);

    // Simulated response
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      recipient,
      provider: 'sendgrid',
    };
  }

  /**
   * Send via AWS SES
   */
  private async sendViaSES(
    recipient: EmailRecipient,
    payload: EmailPayload
  ): Promise<EmailResult> {
    if (!this.config.ses) {
      throw new Error('AWS SES not configured');
    }

    // In production, use AWS SDK:
    // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    // const client = new SESClient({
    //   region: this.config.ses.region,
    //   credentials: {
    //     accessKeyId: this.config.ses.accessKeyId,
    //     secretAccessKey: this.config.ses.secretAccessKey,
    //   },
    // });
    //
    // const command = new SendEmailCommand({
    //   Source: `${this.config.fromName} <${this.config.fromEmail}>`,
    //   Destination: { ToAddresses: [recipient.email] },
    //   Message: {
    //     Subject: { Data: payload.subject },
    //     Body: {
    //       Html: payload.html ? { Data: payload.html } : undefined,
    //       Text: payload.text ? { Data: payload.text } : undefined,
    //     },
    //   },
    // });
    //
    // const response = await client.send(command);

    // Simulated response
    const messageId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      recipient,
      provider: 'ses',
    };
  }

  /**
   * Send via SMTP
   */
  private async sendViaSMTP(
    recipient: EmailRecipient,
    payload: EmailPayload
  ): Promise<EmailResult> {
    if (!this.config.smtp) {
      throw new Error('SMTP not configured');
    }

    // In production, use nodemailer:
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport(this.config.smtp);
    //
    // const info = await transporter.sendMail({
    //   from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
    //   to: recipient.email,
    //   subject: payload.subject,
    //   text: payload.text,
    //   html: payload.html,
    //   attachments: payload.attachments,
    // });

    // Simulated response
    const messageId = `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      recipient,
      provider: 'smtp',
    };
  }

  /**
   * Mock email for development
   */
  private async sendViaMock(
    recipient: EmailRecipient,
    payload: EmailPayload
  ): Promise<EmailResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    logger.debug('Mock email sent', {
      to: recipient.email,
      subject: payload.subject,
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      recipient,
      provider: 'mock',
    };
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    recipient: EmailRecipient,
    orderDetails: {
      orderId: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      deliveryAddress: string;
      estimatedDelivery: string;
    }
  ): Promise<EmailResult> {
    const itemsHtml = orderDetails.items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Order Confirmed!</h1>
        <p>Hi ${recipient.name || 'there'},</p>
        <p>Thank you for your order. Here are the details:</p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> #${orderDetails.orderId.slice(-8)}</p>
          <p><strong>Delivery Address:</strong> ${orderDetails.deliveryAddress}</p>
          <p><strong>Estimated Delivery:</strong> ${orderDetails.estimatedDelivery}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
              <td style="padding: 10px; text-align: right;"><strong>₹${orderDetails.total.toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <p style="margin-top: 20px;">You can track your order in the app.</p>
        <p>Thanks for choosing LMA!</p>
      </div>
    `;

    return this.send(recipient, {
      subject: `Order Confirmed - #${orderDetails.orderId.slice(-8)}`,
      html,
      text: `Order #${orderDetails.orderId.slice(-8)} confirmed. Total: ₹${orderDetails.total}. Delivery to: ${orderDetails.deliveryAddress}`,
    });
  }

  /**
   * Send delivery completed email
   */
  async sendDeliveryCompleted(
    recipient: EmailRecipient,
    orderDetails: {
      orderId: string;
      total: number;
      deliveryTime: string;
      feedbackLink: string;
    }
  ): Promise<EmailResult> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">Delivered!</h1>
        <p>Hi ${recipient.name || 'there'},</p>
        <p>Your order #${orderDetails.orderId.slice(-8)} has been delivered.</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order Total:</strong> ₹${orderDetails.total.toFixed(2)}</p>
          <p><strong>Delivered at:</strong> ${orderDetails.deliveryTime}</p>
        </div>

        <p>We'd love to hear your feedback!</p>
        <a href="${orderDetails.feedbackLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 10px 0;">
          Rate Your Experience
        </a>

        <p style="margin-top: 20px;">Thank you for ordering with LMA!</p>
      </div>
    `;

    return this.send(recipient, {
      subject: `Order Delivered - #${orderDetails.orderId.slice(-8)}`,
      html,
      text: `Order #${orderDetails.orderId.slice(-8)} delivered. Rate your experience: ${orderDetails.feedbackLink}`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    recipient: EmailRecipient,
    resetLink: string,
    expiryMinutes: number = 60
  ): Promise<EmailResult> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset</h1>
        <p>Hi ${recipient.name || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>

        <a href="${resetLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0;">
          Reset Password
        </a>

        <p style="color: #666; font-size: 14px;">This link will expire in ${expiryMinutes} minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    return this.send(recipient, {
      subject: 'Reset Your Password - LMA',
      html,
      text: `Reset your password: ${resetLink}. Link expires in ${expiryMinutes} minutes.`,
    });
  }
}

export const emailChannel = new EmailNotificationChannel();
export type { EmailPayload, EmailRecipient, EmailResult };
