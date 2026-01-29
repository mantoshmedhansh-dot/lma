import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useOrdersStore } from '@/lib/store/orders';
import { PhotoCapture } from '@/components/PhotoCapture';
import { SignatureCapture } from '@/components/SignatureCapture';

type DeliveryType = 'standard' | 'contactless' | 'handed';
type PaymentMethod = 'prepaid' | 'cod';

export default function DeliveryCompletionScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { activeOrder, completeDelivery, loading } = useOrdersStore();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('prepaid');
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [notes, setNotes] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [codCollected, setCodCollected] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeOrder) {
      // Set payment method based on order
      setPaymentMethod(activeOrder.payment_method === 'cod' ? 'cod' : 'prepaid');
      if (activeOrder.payment_method === 'cod') {
        setCodAmount(activeOrder.total_amount?.toString() || '');
      }
    }
  }, [activeOrder]);

  const deliveryTypes: { key: DeliveryType; label: string; icon: string; description: string }[] = [
    {
      key: 'handed',
      label: 'Handed to Customer',
      icon: 'hand-left',
      description: 'Package handed directly to customer',
    },
    {
      key: 'contactless',
      label: 'Contactless',
      icon: 'home',
      description: 'Left at door or designated spot',
    },
    {
      key: 'standard',
      label: 'Standard',
      icon: 'cube',
      description: 'Regular delivery with photo proof',
    },
  ];

  const canComplete = () => {
    // At least one photo required
    if (photos.length === 0) return false;

    // Signature required for handed delivery
    if (deliveryType === 'handed' && !signature) return false;

    // COD must be collected
    if (paymentMethod === 'cod' && !codCollected) return false;

    return true;
  };

  const handleComplete = async () => {
    if (!canComplete()) {
      Alert.alert('Missing Information', 'Please complete all required fields.');
      return;
    }

    Alert.alert(
      'Confirm Delivery',
      'Are you sure you want to mark this order as delivered?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              const podData = {
                delivery_type: deliveryType,
                photos,
                signature,
                notes,
                cod_collected: paymentMethod === 'cod' ? codCollected : null,
                cod_amount: paymentMethod === 'cod' ? parseFloat(codAmount) : null,
                completed_at: new Date().toISOString(),
              };

              const { error } = await completeDelivery(orderId!, podData);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                Alert.alert('Success', 'Delivery completed successfully!', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/orders'),
                  },
                ]);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to complete delivery. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (!activeOrder) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.orderHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Order #{activeOrder.order_number}
            </Text>
            <Text style={[styles.merchantName, { color: colors.textSecondary }]}>
              {activeOrder.merchant?.name}
            </Text>
          </View>
          <View style={styles.customerInfo}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.customerName, { color: colors.text }]}>
              {activeOrder.customer?.full_name}
            </Text>
          </View>
          <View style={styles.addressInfo}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.address, { color: colors.textSecondary }]}>
              {activeOrder.delivery_address?.street}, {activeOrder.delivery_address?.city}
            </Text>
          </View>
        </View>

        {/* Delivery Type */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Delivery Type
          </Text>
          <View style={styles.deliveryTypes}>
            {deliveryTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.deliveryTypeOption,
                  { borderColor: deliveryType === type.key ? colors.tint : colors.border },
                  deliveryType === type.key && { backgroundColor: colors.tintLight },
                ]}
                onPress={() => setDeliveryType(type.key)}
              >
                <View style={styles.deliveryTypeHeader}>
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={deliveryType === type.key ? colors.tint : colors.textSecondary}
                  />
                  {deliveryType === type.key && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.tint} />
                  )}
                </View>
                <Text
                  style={[
                    styles.deliveryTypeLabel,
                    { color: deliveryType === type.key ? colors.tint : colors.text },
                  ]}
                >
                  {type.label}
                </Text>
                <Text style={[styles.deliveryTypeDesc, { color: colors.textSecondary }]}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photo Capture */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <PhotoCapture
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={3}
            colors={colors as any}
          />
        </View>

        {/* Signature (for handed delivery) */}
        {deliveryType === 'handed' && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Customer Signature
            </Text>
            {signature ? (
              <View style={styles.signaturePreview}>
                <View
                  style={[
                    styles.signatureBox,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.signatureText, { color: colors.textSecondary }]}>
                    Signature captured
                  </Text>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
                <TouchableOpacity
                  style={[styles.changeButton, { borderColor: colors.tint }]}
                  onPress={() => setShowSignature(true)}
                >
                  <Text style={[styles.changeButtonText, { color: colors.tint }]}>
                    Change
                  </Text>
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
        )}

        {/* COD Collection */}
        {paymentMethod === 'cod' && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Cash on Delivery
            </Text>
            <View style={styles.codInfo}>
              <Text style={[styles.codLabel, { color: colors.textSecondary }]}>
                Amount to Collect:
              </Text>
              <Text style={[styles.codAmount, { color: colors.text }]}>
                ₹{activeOrder.total_amount}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.codConfirmButton,
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
              <Text
                style={[
                  styles.codConfirmText,
                  { color: codCollected ? '#FFFFFF' : colors.text },
                ]}
              >
                {codCollected ? 'Cash Collected' : 'Mark as Collected'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Notes */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Delivery Notes (Optional)
          </Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Add any notes about the delivery..."
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Complete Button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>
            Delivery Fee
          </Text>
          <Text style={[styles.footerAmount, { color: colors.tint }]}>
            ₹{activeOrder.delivery_fee}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { backgroundColor: canComplete() ? colors.success : colors.border },
          ]}
          onPress={handleComplete}
          disabled={!canComplete() || submitting}
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
    gap: 4,
  },
  merchantName: {
    fontSize: 14,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '500',
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  address: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  deliveryTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  deliveryTypeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  deliveryTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  deliveryTypeDesc: {
    fontSize: 11,
    lineHeight: 14,
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
  codInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codLabel: {
    fontSize: 14,
  },
  codAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  codConfirmButton: {
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 16,
  },
  footerInfo: {
    gap: 2,
  },
  footerLabel: {
    fontSize: 12,
  },
  footerAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  completeButton: {
    flex: 1,
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
