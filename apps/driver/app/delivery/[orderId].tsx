import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useRouteStore } from '@/lib/store/route';
import { PhotoCapture } from '@/components/PhotoCapture';
import { SignatureCapture } from '@/components/SignatureCapture';
import * as deliveryApi from '@/lib/api/delivery';
import { FAILURE_REASONS, type FailureReason } from '@/lib/types/route';

type DeliveryPath = null | 'deliver' | 'failed';

export default function DeliveryScreen() {
  const { orderId: stopId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { route, markArrived, markComplete, refresh } = useRouteStore();

  const stop = route?.stops.find((s) => s.id === stopId);
  const order = stop?.order;

  // State
  const [path, setPath] = useState<DeliveryPath>(null);
  const [submitting, setSubmitting] = useState(false);

  // Arrive state
  const [arriving, setArriving] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // POD state
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [codCollected, setCodCollected] = useState(false);
  const [notes, setNotes] = useState('');

  // Failure state
  const [failureReason, setFailureReason] = useState<FailureReason | null>(null);
  const [failureNotes, setFailureNotes] = useState('');
  const [failurePhotos, setFailurePhotos] = useState<string[]>([]);

  // OTP resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  const handleArrive = useCallback(async () => {
    if (!stopId) return;
    setArriving(true);
    try {
      await markArrived(stopId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark arrival');
    } finally {
      setArriving(false);
    }
  }, [stopId, markArrived]);

  const handleSendOtp = useCallback(async () => {
    if (!order) return;
    setSendingOtp(true);
    try {
      await deliveryApi.sendOtp(order.id, 'delivery');
      setOtpSent(true);
      setResendTimer(30);
      const masked = order.customer_phone.replace(/.(?=.{4})/g, '*');
      Alert.alert('OTP Sent', `OTP sent to ${masked}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  }, [order]);

  const handleVerifyOtp = useCallback(async () => {
    if (!order || !otpCode) return;
    setVerifyingOtp(true);
    try {
      const result = await deliveryApi.verifyOtp(order.id, otpCode, 'delivery');
      if (result.verified) {
        setOtpVerified(true);
      } else {
        Alert.alert('Invalid OTP', 'The code you entered is incorrect. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  }, [order, otpCode]);

  const handleCompleteDelivery = useCallback(async () => {
    if (!stopId || !order) return;

    if (photos.length === 0) {
      Alert.alert('Photo Required', 'Please take at least one photo as proof of delivery.');
      return;
    }
    if (order.is_cod && !codCollected) {
      Alert.alert('COD Required', 'Please confirm cash collection before completing.');
      return;
    }

    Alert.alert('Confirm Delivery', 'Mark this delivery as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setSubmitting(true);
          try {
            // Upload photos
            const photoUrls: string[] = [];
            for (const uri of photos) {
              const url = await deliveryApi.uploadPhoto(order.id, uri);
              photoUrls.push(url);
            }

            // Upload signature if present
            let signatureUrl: string | null = null;
            if (signature) {
              signatureUrl = await deliveryApi.uploadPhoto(order.id, signature);
            }

            // Record attempt
            await deliveryApi.recordAttempt({
              order_id: order.id,
              status: 'delivered',
              photo_urls: photoUrls,
              signature_url: signatureUrl,
              cod_collected: order.is_cod ? codCollected : false,
              cod_amount: order.is_cod ? order.cod_amount : null,
              notes: notes || null,
            });

            // Complete the stop
            await markComplete(stopId, 'delivered');

            Alert.alert('Success', 'Delivery completed!', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to complete delivery');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [stopId, order, photos, signature, codCollected, notes, markComplete, router]);

  const handleFailDelivery = useCallback(async () => {
    if (!stopId || !order) return;

    if (!failureReason) {
      Alert.alert('Reason Required', 'Please select a failure reason.');
      return;
    }
    if (failureReason === 'other' && !failureNotes.trim()) {
      Alert.alert('Notes Required', 'Please add notes explaining the failure.');
      return;
    }

    Alert.alert('Confirm Failed Delivery', 'Mark this delivery as failed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Failed',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            // Upload failure photos
            const photoUrls: string[] = [];
            for (const uri of failurePhotos) {
              const url = await deliveryApi.uploadPhoto(order.id, uri);
              photoUrls.push(url);
            }

            // Record attempt
            await deliveryApi.recordAttempt({
              order_id: order.id,
              status: 'failed',
              photo_urls: photoUrls,
              failure_reason: failureReason,
              failure_notes: failureNotes || null,
            });

            // Complete the stop as failed
            await markComplete(stopId, 'failed');

            Alert.alert('Marked Failed', 'Moving to next stop.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to record failure');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [stopId, order, failureReason, failureNotes, failurePhotos, markComplete, router]);

  const openMaps = () => {
    if (!order) return;
    const { delivery_latitude: lat, delivery_longitude: lng, delivery_address } = order;
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery_address)}`,
      );
    }
  };

  if (!stop || !order) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const isArrived = stop.status === 'arrived';
  const needsArrive = stop.status === 'pending';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Stop Details Header */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.orderHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Order #{order.order_number}
            </Text>
            <View style={[styles.stopSeqBadge, { backgroundColor: colors.tint }]}>
              <Text style={styles.stopSeqText}>Stop {stop.sequence}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.text }]}>{order.customer_name}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}>
              <Ionicons name="call" size={20} color={colors.tint} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.detailRow} onPress={openMaps}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={2}>
              {order.delivery_address}
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.tint} />
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {order.product_description}
            </Text>
          </View>

          {order.is_cod && (
            <View style={[styles.codBanner, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="cash-outline" size={20} color={colors.warning} />
              <Text style={[styles.codBannerText, { color: colors.warning }]}>
                COD: Rs. {order.cod_amount}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.navigateButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={openMaps}
          >
            <Ionicons name="navigate" size={18} color={colors.tint} />
            <Text style={[styles.navigateText, { color: colors.tint }]}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Step 2: Mark Arrived */}
        {needsArrive && (
          <TouchableOpacity
            style={[styles.arriveButton, { backgroundColor: colors.tint }]}
            onPress={handleArrive}
            disabled={arriving}
          >
            {arriving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="flag" size={22} color="#FFFFFF" />
                <Text style={styles.arriveButtonText}>I've Arrived</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Step 3: Choose Path */}
        {isArrived && !path && (
          <View style={styles.pathChoice}>
            <Text style={[styles.pathTitle, { color: colors.text }]}>Delivery Outcome</Text>
            <View style={styles.pathButtons}>
              <TouchableOpacity
                style={[styles.pathButton, { backgroundColor: colors.success }]}
                onPress={() => setPath('deliver')}
              >
                <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                <Text style={styles.pathButtonText}>Deliver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pathButton, { backgroundColor: colors.error }]}
                onPress={() => setPath('failed')}
              >
                <Ionicons name="close-circle" size={28} color="#FFFFFF" />
                <Text style={styles.pathButtonText}>Failed</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Path A: Successful Delivery */}
        {path === 'deliver' && (
          <>
            {/* OTP Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>OTP Verification</Text>

              {!otpSent ? (
                <TouchableOpacity
                  style={[styles.otpSendButton, { backgroundColor: colors.tint }]}
                  onPress={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.otpSendText}>Send OTP to Customer</Text>
                  )}
                </TouchableOpacity>
              ) : !otpVerified ? (
                <View style={styles.otpInputSection}>
                  <TextInput
                    style={[
                      styles.otpInput,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                    ]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={colors.textSecondary}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.otpActions}>
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={resendTimer > 0 || sendingOtp}
                    >
                      <Text style={[styles.resendText, { color: resendTimer > 0 ? colors.textSecondary : colors.tint }]}>
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, { backgroundColor: otpCode.length === 6 ? colors.tint : colors.border }]}
                      onPress={handleVerifyOtp}
                      disabled={otpCode.length !== 6 || verifyingOtp}
                    >
                      {verifyingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.verifyText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.otpVerifiedBanner, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <Text style={[styles.otpVerifiedText, { color: colors.success }]}>OTP Verified</Text>
                </View>
              )}
            </View>

            {/* Photo + Signature + COD + Notes (only after OTP verified) */}
            {otpVerified && (
              <>
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                  <PhotoCapture
                    photos={photos}
                    onPhotosChange={setPhotos}
                    maxPhotos={3}
                    colors={colors as any}
                  />
                </View>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Customer Signature (Optional)
                  </Text>
                  {signature ? (
                    <View style={styles.signaturePreview}>
                      <View style={[styles.signatureBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.signatureText, { color: colors.textSecondary }]}>Signature captured</Text>
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      </View>
                      <TouchableOpacity
                        style={[styles.changeButton, { borderColor: colors.tint }]}
                        onPress={() => setShowSignature(true)}
                      >
                        <Text style={[styles.changeButtonText, { color: colors.tint }]}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.signatureButton, { borderColor: colors.tint }]}
                      onPress={() => setShowSignature(true)}
                    >
                      <Ionicons name="create-outline" size={24} color={colors.tint} />
                      <Text style={[styles.signatureButtonText, { color: colors.tint }]}>
                        Capture Signature
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {order.is_cod && (
                  <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Cash on Delivery</Text>
                    <View style={styles.codRow}>
                      <Text style={[styles.codLabel, { color: colors.textSecondary }]}>Amount to Collect:</Text>
                      <Text style={[styles.codAmount, { color: colors.text }]}>Rs. {order.cod_amount}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.codConfirm,
                        {
                          backgroundColor: codCollected ? colors.success : colors.background,
                          borderColor: codCollected ? colors.success : colors.border,
                        },
                      ]}
                      onPress={() => setCodCollected(!codCollected)}
                    >
                      <Ionicons
                        name={codCollected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={codCollected ? '#FFFFFF' : colors.textSecondary}
                      />
                      <Text style={[styles.codConfirmText, { color: codCollected ? '#FFFFFF' : colors.text }]}>
                        {codCollected ? 'Cash Collected' : `Cash Rs. ${order.cod_amount} collected`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Add any delivery notes..."
                    placeholderTextColor={colors.textSecondary}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}
          </>
        )}

        {/* Path B: Failed Delivery */}
        {path === 'failed' && (
          <>
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Failure Reason</Text>
              {FAILURE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.reasonOption,
                    {
                      borderColor: failureReason === reason.value ? colors.error : colors.border,
                      backgroundColor: failureReason === reason.value ? colors.error + '10' : 'transparent',
                    },
                  ]}
                  onPress={() => setFailureReason(reason.value)}
                >
                  <Ionicons
                    name={failureReason === reason.value ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={failureReason === reason.value ? colors.error : colors.textSecondary}
                  />
                  <Text style={[styles.reasonText, { color: colors.text }]}>{reason.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Notes {failureReason === 'other' ? '(Required)' : '(Optional)'}
              </Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Describe what happened..."
                placeholderTextColor={colors.textSecondary}
                value={failureNotes}
                onChangeText={setFailureNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Photo (Optional)
              </Text>
              <PhotoCapture
                photos={failurePhotos}
                onPhotosChange={setFailurePhotos}
                maxPhotos={2}
                colors={colors as any}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      {path === 'deliver' && otpVerified && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: photos.length > 0 ? colors.success : colors.border }]}
            onPress={handleCompleteDelivery}
            disabled={photos.length === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {path === 'failed' && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.failButton, { backgroundColor: failureReason ? colors.error : colors.border }]}
            onPress={handleFailDelivery}
            disabled={!failureReason || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Mark as Failed</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Signature Modal */}
      <SignatureCapture
        visible={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={(sig) => {
          setSignature(sig);
          setShowSignature(false);
        }}
        colors={colors as any}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopSeqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopSeqText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  codBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  codBannerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  navigateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  arriveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    gap: 10,
  },
  arriveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  pathChoice: {
    gap: 12,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pathButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pathButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 14,
    gap: 8,
  },
  pathButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  otpSendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
  },
  otpSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  otpInputSection: {
    gap: 10,
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  verifyButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  verifyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  otpVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  otpVerifiedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  signatureText: {
    fontSize: 14,
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  codRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codLabel: {
    fontSize: 14,
  },
  codAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  codConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  codConfirmText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  reasonText: {
    fontSize: 15,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  failButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
