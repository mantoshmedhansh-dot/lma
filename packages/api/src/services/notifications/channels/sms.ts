/**
 * SMS Notification Channel
 *
 * Handles SMS notifications via multiple providers:
 * - Twilio (international)
 * - MSG91 (India-focused)
 * - Fallback support
 */

import { logger } from '../../../lib/logger.js';

interface SMSPayload {
  message: string;
  templateId?: string; // For DLT-registered templates (India)
  variables?: Record<string, string>;
  sender?: string;
}

interface SMSRecipient {
  userId: string;
  phoneNumber: string;
  countryCode?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipient: SMSRecipient;
  provider: string;
  cost?: number;
}

type SMSProvider = 'twilio' | 'msg91' | 'mock';

interface ProviderConfig {
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  msg91?: {
    authKey: string;
    senderId: string;
  };
}

class SMSNotificationChannel {
  private config: ProviderConfig = {};
  private defaultProvider: SMSProvider = 'mock';

  /**
   * Initialize SMS providers
   */
  initialize(config: ProviderConfig, defaultProvider: SMSProvider = 'twilio'): void {
    this.config = config;
    this.defaultProvider = defaultProvider;
    logger.info('SMS notification channel initialized', { provider: defaultProvider });
  }

  /**
   * Send SMS to a single recipient
   */
  async send(
    recipient: SMSRecipient,
    payload: SMSPayload,
    provider?: SMSProvider
  ): Promise<SMSResult> {
    const selectedProvider = provider || this.defaultProvider;

    try {
      let result: SMSResult;

      switch (selectedProvider) {
        case 'twilio':
          result = await this.sendViaTwilio(recipient, payload);
          break;
        case 'msg91':
          result = await this.sendViaMsg91(recipient, payload);
          break;
        default:
          result = await this.sendViaMock(recipient, payload);
      }

      if (result.success) {
        logger.info('SMS sent successfully', {
          userId: recipient.userId,
          provider: selectedProvider,
          messageId: result.messageId,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send SMS', {
        userId: recipient.userId,
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
   * Send SMS to multiple recipients
   */
  async sendBatch(
    recipients: SMSRecipient[],
    payload: SMSPayload,
    provider?: SMSProvider
  ): Promise<SMSResult[]> {
    const results = await Promise.all(
      recipients.map((recipient) => this.send(recipient, payload, provider))
    );

    const successCount = results.filter((r) => r.success).length;
    logger.info('Batch SMS sent', {
      total: recipients.length,
      success: successCount,
      failed: recipients.length - successCount,
    });

    return results;
  }

  /**
   * Send via Twilio
   */
  private async sendViaTwilio(
    recipient: SMSRecipient,
    payload: SMSPayload
  ): Promise<SMSResult> {
    if (!this.config.twilio) {
      throw new Error('Twilio not configured');
    }

    // In production, use Twilio SDK:
    // const twilio = require('twilio')(
    //   this.config.twilio.accountSid,
    //   this.config.twilio.authToken
    // );
    //
    // const message = await twilio.messages.create({
    //   body: payload.message,
    //   from: this.config.twilio.fromNumber,
    //   to: formatPhoneNumber(recipient.phoneNumber, recipient.countryCode),
    // });

    // Simulated response
    const messageId = `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      recipient,
      provider: 'twilio',
      cost: 0.0075, // Approximate cost per SMS
    };
  }

  /**
   * Send via MSG91 (India)
   */
  private async sendViaMsg91(
    recipient: SMSRecipient,
    payload: SMSPayload
  ): Promise<SMSResult> {
    if (!this.config.msg91) {
      throw new Error('MSG91 not configured');
    }

    // In production, use MSG91 API:
    // const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    //   method: 'POST',
    //   headers: {
    //     'authkey': this.config.msg91.authKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     template_id: payload.templateId,
    //     sender: this.config.msg91.senderId,
    //     short_url: '0',
    //     mobiles: recipient.phoneNumber,
    //     ...payload.variables,
    //   }),
    // });

    // Simulated response
    const messageId = `msg91_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      recipient,
      provider: 'msg91',
      cost: 0.002, // Approximate cost per SMS in India
    };
  }

  /**
   * Mock SMS for development
   */
  private async sendViaMock(
    recipient: SMSRecipient,
    payload: SMSPayload
  ): Promise<SMSResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.debug('Mock SMS sent', {
      to: recipient.phoneNumber,
      message: payload.message,
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      recipient,
      provider: 'mock',
      cost: 0,
    };
  }

  /**
   * Send OTP SMS
   */
  async sendOTP(
    recipient: SMSRecipient,
    otp: string,
    expiryMinutes: number = 10
  ): Promise<SMSResult> {
    const payload: SMSPayload = {
      message: `Your LMA verification code is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`,
      templateId: 'otp_template', // DLT template ID
      variables: {
        otp,
        expiry: String(expiryMinutes),
      },
    };

    return this.send(recipient, payload);
  }

  /**
   * Send order status update SMS
   */
  async sendOrderUpdate(
    recipient: SMSRecipient,
    orderId: string,
    status: string,
    details?: string
  ): Promise<SMSResult> {
    const statusMessages: Record<string, string> = {
      confirmed: `Your order #${orderId.slice(-6)} has been confirmed and is being prepared.`,
      ready_for_pickup: `Your order #${orderId.slice(-6)} is ready! Driver is on the way to pick it up.`,
      picked_up: `Your order #${orderId.slice(-6)} has been picked up and is on the way to you.`,
      delivered: `Your order #${orderId.slice(-6)} has been delivered. Thank you for ordering!`,
      cancelled: `Your order #${orderId.slice(-6)} has been cancelled. ${details || ''}`,
    };

    const message = statusMessages[status] || `Order #${orderId.slice(-6)} status: ${status}`;

    return this.send(recipient, { message });
  }

  /**
   * Check SMS balance/credits
   */
  async checkBalance(provider: SMSProvider = this.defaultProvider): Promise<{
    balance: number;
    currency: string;
  }> {
    // In production, query provider API for balance
    return { balance: 1000, currency: 'INR' };
  }
}

export const smsChannel = new SMSNotificationChannel();
export type { SMSPayload, SMSRecipient, SMSResult };
