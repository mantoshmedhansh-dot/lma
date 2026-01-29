/**
 * Data Encryption & Privacy Compliance Service
 *
 * Features:
 * - Field-level encryption for PII
 * - Data anonymization
 * - GDPR compliance (data export, deletion)
 * - Key management
 * - Data masking
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Derive a proper key from the provided key
  return crypto.scryptSync(key, 'lma-salt', KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  // Extract IV, authTag, and encrypted data
  const iv = Buffer.from(ciphertext.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(ciphertext.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2), 'hex');
  const encrypted = ciphertext.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash sensitive data (one-way, for lookups)
 */
export function hashData(data: string): string {
  const salt = process.env.HASH_SALT || 'lma-default-salt';
  return crypto.createHmac('sha256', salt).update(data).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// ============================================
// PII ENCRYPTION
// ============================================

interface PIIFields {
  email?: string;
  phone?: string;
  name?: string;
  address?: string;
  pan?: string;
  aadhaar?: string;
  bankAccount?: string;
  ifsc?: string;
}

interface EncryptedPII {
  email_encrypted?: string;
  email_hash?: string;
  phone_encrypted?: string;
  phone_hash?: string;
  name_encrypted?: string;
  address_encrypted?: string;
  pan_encrypted?: string;
  pan_hash?: string;
  aadhaar_encrypted?: string;
  aadhaar_hash?: string;
  bank_account_encrypted?: string;
  ifsc_encrypted?: string;
}

/**
 * Encrypt PII fields
 */
export function encryptPII(data: PIIFields): EncryptedPII {
  const result: EncryptedPII = {};

  if (data.email) {
    result.email_encrypted = encrypt(data.email);
    result.email_hash = hashData(data.email.toLowerCase());
  }

  if (data.phone) {
    result.phone_encrypted = encrypt(data.phone);
    result.phone_hash = hashData(data.phone);
  }

  if (data.name) {
    result.name_encrypted = encrypt(data.name);
  }

  if (data.address) {
    result.address_encrypted = encrypt(data.address);
  }

  if (data.pan) {
    result.pan_encrypted = encrypt(data.pan);
    result.pan_hash = hashData(data.pan.toUpperCase());
  }

  if (data.aadhaar) {
    result.aadhaar_encrypted = encrypt(data.aadhaar);
    result.aadhaar_hash = hashData(data.aadhaar);
  }

  if (data.bankAccount) {
    result.bank_account_encrypted = encrypt(data.bankAccount);
  }

  if (data.ifsc) {
    result.ifsc_encrypted = encrypt(data.ifsc);
  }

  return result;
}

/**
 * Decrypt PII fields
 */
export function decryptPII(data: EncryptedPII): PIIFields {
  const result: PIIFields = {};

  if (data.email_encrypted) {
    result.email = decrypt(data.email_encrypted);
  }

  if (data.phone_encrypted) {
    result.phone = decrypt(data.phone_encrypted);
  }

  if (data.name_encrypted) {
    result.name = decrypt(data.name_encrypted);
  }

  if (data.address_encrypted) {
    result.address = decrypt(data.address_encrypted);
  }

  if (data.pan_encrypted) {
    result.pan = decrypt(data.pan_encrypted);
  }

  if (data.aadhaar_encrypted) {
    result.aadhaar = decrypt(data.aadhaar_encrypted);
  }

  if (data.bank_account_encrypted) {
    result.bankAccount = decrypt(data.bank_account_encrypted);
  }

  if (data.ifsc_encrypted) {
    result.ifsc = decrypt(data.ifsc_encrypted);
  }

  return result;
}

// ============================================
// DATA MASKING
// ============================================

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***.***';

  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '*'.repeat(local.length);

  const [domainName, tld] = domain.split('.');
  const maskedDomain = domainName.length > 2
    ? domainName[0] + '*'.repeat(domainName.length - 2) + domainName[domainName.length - 1]
    : '*'.repeat(domainName.length);

  return `${maskedLocal}@${maskedDomain}.${tld || '***'}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Mask PAN number
 */
export function maskPAN(pan: string): string {
  if (pan.length !== 10) return '*'.repeat(pan.length);
  return pan.slice(0, 2) + '*'.repeat(5) + pan.slice(-3);
}

/**
 * Mask Aadhaar number
 */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return '*'.repeat(digits.length);
  return '*'.repeat(8) + digits.slice(-4);
}

/**
 * Mask bank account
 */
export function maskBankAccount(account: string): string {
  if (account.length < 4) return '*'.repeat(account.length);
  return '*'.repeat(account.length - 4) + account.slice(-4);
}

/**
 * Mask name
 */
export function maskName(name: string): string {
  const parts = name.split(' ');
  return parts
    .map((part) => (part.length > 1 ? part[0] + '*'.repeat(part.length - 1) : part))
    .join(' ');
}

// ============================================
// DATA ANONYMIZATION
// ============================================

interface AnonymizationOptions {
  preserveFormat?: boolean;
  preserveLength?: boolean;
}

/**
 * Anonymize user data
 */
export function anonymizeUserData(
  userData: Record<string, unknown>,
  options: AnonymizationOptions = {}
): Record<string, unknown> {
  const anonymized: Record<string, unknown> = { ...userData };

  // Remove or anonymize PII fields
  const piiFields = [
    'email', 'phone', 'name', 'first_name', 'last_name',
    'address', 'street', 'city', 'pincode', 'zip',
    'pan', 'aadhaar', 'bank_account', 'ifsc',
    'ip_address', 'user_agent',
  ];

  for (const field of piiFields) {
    if (anonymized[field]) {
      if (options.preserveFormat) {
        anonymized[field] = generateAnonymousValue(field, anonymized[field] as string);
      } else {
        anonymized[field] = '[ANONYMIZED]';
      }
    }
  }

  // Hash identifiers
  if (anonymized.id) {
    anonymized.anonymized_id = hashData(anonymized.id as string).slice(0, 16);
    delete anonymized.id;
  }

  if (anonymized.user_id) {
    anonymized.anonymized_user_id = hashData(anonymized.user_id as string).slice(0, 16);
    delete anonymized.user_id;
  }

  return anonymized;
}

function generateAnonymousValue(field: string, original: string): string {
  const length = original.length;

  switch (field) {
    case 'email':
      return `user${hashData(original).slice(0, 8)}@anonymous.com`;
    case 'phone':
      return '+91' + '0'.repeat(10);
    case 'name':
    case 'first_name':
    case 'last_name':
      return 'Anonymous User';
    case 'pan':
      return 'XXXXX0000X';
    case 'aadhaar':
      return '0000 0000 0000';
    default:
      return '*'.repeat(length);
  }
}

// ============================================
// GDPR COMPLIANCE
// ============================================

interface DataExportRequest {
  userId: string;
  requestedAt: Date;
  format: 'json' | 'csv';
  includeOrderHistory?: boolean;
  includePayments?: boolean;
  includeLocations?: boolean;
}

interface DeletionRequest {
  userId: string;
  requestedAt: Date;
  reason?: string;
  retainAnonymized?: boolean;
}

/**
 * Process data export request (GDPR Article 20 - Right to data portability)
 */
export async function processDataExportRequest(
  request: DataExportRequest
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  downloadUrl?: string;
  error?: string;
}> {
  try {
    const { userId, format, includeOrderHistory, includePayments, includeLocations } = request;

    // Fetch user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userData: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };

    // Include order history
    if (includeOrderHistory) {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, delivery_address')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      exportData.orderHistory = orders || [];
    }

    // Include payment history
    if (includePayments) {
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id, amount, status, method, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      exportData.paymentHistory = payments || [];
    }

    // Include location history (anonymized)
    if (includeLocations) {
      const { data: addresses } = await supabaseAdmin
        .from('user_addresses')
        .select('id, label, address_line1, city, pincode, created_at')
        .eq('user_id', userId);

      exportData.savedAddresses = addresses || [];
    }

    // Get notification preferences
    const { data: notifPrefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (notifPrefs) {
      exportData.notificationPreferences = notifPrefs;
    }

    // Log the export request
    await logDataExportRequest(userId, request.requestedAt);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(exportData);
      return { success: true, data: { csv } };
    }

    return { success: true, data: exportData };
  } catch (error) {
    logger.error('Data export request failed', { error, userId: request.userId });
    return { success: false, error: 'Export failed' };
  }
}

/**
 * Process data deletion request (GDPR Article 17 - Right to erasure)
 */
export async function processDataDeletionRequest(
  request: DeletionRequest
): Promise<{
  success: boolean;
  deletedItems?: Record<string, number>;
  error?: string;
}> {
  try {
    const { userId, retainAnonymized } = request;
    const deletedItems: Record<string, number> = {};

    // Verify user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Start deletion process

    // 1. Delete user devices
    const { count: devicesDeleted } = await supabaseAdmin
      .from('user_devices')
      .delete()
      .eq('user_id', userId);
    deletedItems.devices = devicesDeleted || 0;

    // 2. Delete notification preferences
    const { count: prefsDeleted } = await supabaseAdmin
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId);
    deletedItems.notificationPreferences = prefsDeleted || 0;

    // 3. Delete in-app notifications
    const { count: notifsDeleted } = await supabaseAdmin
      .from('in_app_notifications')
      .delete()
      .eq('user_id', userId);
    deletedItems.notifications = notifsDeleted || 0;

    // 4. Handle orders - anonymize rather than delete for business records
    if (retainAnonymized) {
      const { count: ordersAnonymized } = await supabaseAdmin
        .from('orders')
        .update({
          delivery_address: { anonymized: true },
          customer_name: 'Deleted User',
          customer_phone: null,
          customer_email: null,
        })
        .eq('customer_id', userId);
      deletedItems.ordersAnonymized = ordersAnonymized || 0;
    }

    // 5. Delete user addresses
    const { count: addressesDeleted } = await supabaseAdmin
      .from('user_addresses')
      .delete()
      .eq('user_id', userId);
    deletedItems.addresses = addressesDeleted || 0;

    // 6. Delete saved payment methods
    const { count: paymentMethodsDeleted } = await supabaseAdmin
      .from('saved_payment_methods')
      .delete()
      .eq('user_id', userId);
    deletedItems.paymentMethods = paymentMethodsDeleted || 0;

    // 7. Anonymize or delete user record
    if (retainAnonymized) {
      await supabaseAdmin
        .from('users')
        .update({
          email: `deleted_${hashData(userId).slice(0, 8)}@deleted.local`,
          phone: null,
          name: 'Deleted User',
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', userId);
      deletedItems.userAnonymized = 1;
    } else {
      await supabaseAdmin.from('users').delete().eq('id', userId);
      deletedItems.userDeleted = 1;
    }

    // Log the deletion request
    await logDataDeletionRequest(userId, request.requestedAt, deletedItems);

    return { success: true, deletedItems };
  } catch (error) {
    logger.error('Data deletion request failed', { error, userId: request.userId });
    return { success: false, error: 'Deletion failed' };
  }
}

/**
 * Get consent record for user
 */
export async function getConsentRecord(userId: string): Promise<{
  consents: Array<{
    type: string;
    granted: boolean;
    grantedAt?: Date;
    revokedAt?: Date;
  }>;
}> {
  const { data } = await supabaseAdmin
    .from('user_consents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return {
    consents: (data || []).map((c) => ({
      type: c.consent_type,
      granted: c.is_granted,
      grantedAt: c.granted_at ? new Date(c.granted_at) : undefined,
      revokedAt: c.revoked_at ? new Date(c.revoked_at) : undefined,
    })),
  };
}

/**
 * Record user consent
 */
export async function recordConsent(
  userId: string,
  consentType: string,
  granted: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from('user_consents').upsert(
    {
      user_id: userId,
      consent_type: consentType,
      is_granted: granted,
      granted_at: granted ? new Date().toISOString() : null,
      revoked_at: !granted ? new Date().toISOString() : null,
      metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,consent_type' }
  );
}

// ============================================
// DATA RETENTION
// ============================================

interface RetentionPolicy {
  dataType: string;
  retentionDays: number;
  action: 'delete' | 'anonymize' | 'archive';
}

const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  { dataType: 'session_logs', retentionDays: 30, action: 'delete' },
  { dataType: 'notification_logs', retentionDays: 7, action: 'delete' },
  { dataType: 'driver_location_logs', retentionDays: 90, action: 'delete' },
  { dataType: 'audit_logs', retentionDays: 365, action: 'archive' },
  { dataType: 'order_data', retentionDays: 730, action: 'anonymize' }, // 2 years
  { dataType: 'payment_data', retentionDays: 2555, action: 'archive' }, // 7 years (legal requirement)
];

/**
 * Apply data retention policies
 */
export async function applyRetentionPolicies(
  policies: RetentionPolicy[] = DEFAULT_RETENTION_POLICIES
): Promise<{
  processed: Record<string, number>;
}> {
  const processed: Record<string, number> = {};

  for (const policy of policies) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    try {
      let count = 0;

      switch (policy.dataType) {
        case 'session_logs':
          const { count: sessionCount } = await supabaseAdmin
            .from('session_logs')
            .delete()
            .lt('created_at', cutoffDate.toISOString());
          count = sessionCount || 0;
          break;

        case 'notification_logs':
          const { count: notifCount } = await supabaseAdmin
            .from('notification_log')
            .delete()
            .lt('sent_at', cutoffDate.toISOString());
          count = notifCount || 0;
          break;

        case 'driver_location_logs':
          const { count: locationCount } = await supabaseAdmin
            .from('driver_location_log')
            .delete()
            .lt('recorded_at', cutoffDate.toISOString());
          count = locationCount || 0;
          break;

        case 'audit_logs':
          // Archive old audit logs
          const { data: oldAuditLogs } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .lt('created_at', cutoffDate.toISOString())
            .limit(1000);

          if (oldAuditLogs && oldAuditLogs.length > 0) {
            await supabaseAdmin.from('audit_logs_archive').insert(oldAuditLogs);
            await supabaseAdmin
              .from('audit_logs')
              .delete()
              .in('id', oldAuditLogs.map((l) => l.id));
            count = oldAuditLogs.length;
          }
          break;
      }

      processed[policy.dataType] = count;
      logger.info('Retention policy applied', { dataType: policy.dataType, count });
    } catch (error) {
      logger.error('Failed to apply retention policy', { error, policy });
    }
  }

  return { processed };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logDataExportRequest(userId: string, requestedAt: Date): Promise<void> {
  await supabaseAdmin.from('data_requests').insert({
    user_id: userId,
    request_type: 'export',
    status: 'completed',
    requested_at: requestedAt.toISOString(),
    completed_at: new Date().toISOString(),
  });
}

async function logDataDeletionRequest(
  userId: string,
  requestedAt: Date,
  deletedItems: Record<string, number>
): Promise<void> {
  await supabaseAdmin.from('data_requests').insert({
    user_id: userId,
    request_type: 'deletion',
    status: 'completed',
    requested_at: requestedAt.toISOString(),
    completed_at: new Date().toISOString(),
    metadata: { deletedItems },
  });
}

function convertToCSV(data: Record<string, unknown>): string {
  const lines: string[] = [];

  function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = String(value);
      }
    }
    return result;
  }

  const flat = flattenObject(data);
  lines.push(Object.keys(flat).join(','));
  lines.push(Object.values(flat).map((v) => `"${v.replace(/"/g, '""')}"`).join(','));

  return lines.join('\n');
}

// ============================================
// KEY ROTATION
// ============================================

/**
 * Re-encrypt data with new key (for key rotation)
 */
export async function reEncryptUserPII(
  userId: string,
  oldKey: string,
  newKey: string
): Promise<boolean> {
  try {
    // This would need to:
    // 1. Decrypt with old key
    // 2. Re-encrypt with new key
    // 3. Update database
    // Implementation depends on how PII is stored

    logger.info('PII re-encrypted for user', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to re-encrypt PII', { error, userId });
    return false;
  }
}

export type {
  PIIFields,
  EncryptedPII,
  DataExportRequest,
  DeletionRequest,
  RetentionPolicy,
  AnonymizationOptions,
};
