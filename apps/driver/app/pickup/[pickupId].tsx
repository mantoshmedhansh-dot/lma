import { useEffect, useState, useRef, useCallback } from "react";
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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColor";
import { usePickupStore } from "@/lib/store/pickup";
import { PhotoCapture } from "@/components/PhotoCapture";
import { SignatureCapture } from "@/components/SignatureCapture";
import * as pickupApi from "@/lib/api/pickup";
import {
  PICKUP_FAILURE_REASONS,
  ITEM_CONDITIONS,
  type PickupFailureReason,
  type ItemCondition,
} from "@/lib/types/pickup";

type PickupPhase = "arrive" | "otp" | "collect" | "failed";

export default function PickupScreen() {
  const { pickupId } = useLocalSearchParams<{ pickupId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { pickups, markArrived, markComplete } = usePickupStore();

  const pickup = pickups.find((p) => p.id === pickupId);

  // Phase state
  const [phase, setPhase] = useState<PickupPhase>("arrive");
  const [submitting, setSubmitting] = useState(false);
  const [arriving, setArriving] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collect state
  const [itemCondition, setItemCondition] = useState<ItemCondition | null>(
    null,
  );
  const [conditionPhotos, setConditionPhotos] = useState<string[]>([]);
  const [conditionNotes, setConditionNotes] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);

  // Failure state
  const [failureReason, setFailureReason] =
    useState<PickupFailureReason | null>(null);
  const [failureNotes, setFailureNotes] = useState("");
  const [failurePhotos, setFailurePhotos] = useState<string[]>([]);

  // Initialize phase based on pickup status
  useEffect(() => {
    if (!pickup) return;
    if (pickup.status === "out_for_pickup") {
      setPhase("otp");
    } else if (pickup.status === "assigned") {
      setPhase("arrive");
    }
  }, [pickup?.status]);

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
    if (!pickupId) return;
    setArriving(true);
    try {
      await markArrived(pickupId);
      setPhase("otp");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to mark arrival");
    } finally {
      setArriving(false);
    }
  }, [pickupId, markArrived]);

  const handleSendOtp = useCallback(async () => {
    if (!pickup) return;
    setSendingOtp(true);
    try {
      await pickupApi.sendPickupOtp(pickup.id);
      setOtpSent(true);
      setResendTimer(30);
      const masked = pickup.customer_phone.replace(/.(?=.{4})/g, "*");
      Alert.alert("OTP Sent", `OTP sent to ${masked}`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  }, [pickup]);

  const handleVerifyOtp = useCallback(async () => {
    if (!pickup || !otpCode) return;
    setVerifyingOtp(true);
    try {
      const result = await pickupApi.verifyPickupOtp(pickup.id, otpCode);
      if (result.verified) {
        setOtpVerified(true);
        setPhase("collect");
      } else {
        Alert.alert(
          "Invalid OTP",
          "The code you entered is incorrect. Please try again.",
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to verify OTP");
    } finally {
      setVerifyingOtp(false);
    }
  }, [pickup, otpCode]);

  const handleCompletePickup = useCallback(async () => {
    if (!pickupId || !pickup) return;

    if (!itemCondition) {
      Alert.alert(
        "Condition Required",
        "Please select the item condition before completing.",
      );
      return;
    }
    if (conditionPhotos.length < 2) {
      Alert.alert(
        "Photos Required",
        "Please take at least 2 photos of the item condition.",
      );
      return;
    }

    Alert.alert("Confirm Pickup", "Mark this item as picked up?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setSubmitting(true);
          try {
            // Upload condition photos
            const conditionPhotoUrls: string[] = [];
            for (const uri of conditionPhotos) {
              const url = await pickupApi.uploadPickupPhoto(pickup.id, uri);
              conditionPhotoUrls.push(url);
            }

            // Upload signature
            let signatureUrl: string | null = null;
            if (signature) {
              signatureUrl = await pickupApi.uploadPickupPhoto(
                pickup.id,
                signature,
              );
            }

            // Record attempt
            await pickupApi.recordPickupAttempt({
              pickup_id: pickup.id,
              status: "picked_up",
              otp_verified: otpVerified,
              item_condition: itemCondition,
              item_condition_notes: conditionNotes || null,
              condition_photo_urls: conditionPhotoUrls,
              signature_url: signatureUrl,
            });

            // Update local state
            markComplete(pickupId);

            Alert.alert("Success", "Pickup completed!", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert(
              "Error",
              error.message || "Failed to complete pickup",
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [
    pickupId,
    pickup,
    itemCondition,
    conditionPhotos,
    conditionNotes,
    signature,
    otpVerified,
    markComplete,
    router,
  ]);

  const handleFailPickup = useCallback(async () => {
    if (!pickupId || !pickup) return;

    if (!failureReason) {
      Alert.alert("Reason Required", "Please select a failure reason.");
      return;
    }
    if (failureReason === "other" && !failureNotes.trim()) {
      Alert.alert("Notes Required", "Please add notes explaining the failure.");
      return;
    }

    Alert.alert("Confirm Failed Pickup", "Mark this pickup as failed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Failed",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          try {
            // Upload failure photos
            const photoUrls: string[] = [];
            for (const uri of failurePhotos) {
              const url = await pickupApi.uploadPickupPhoto(pickup.id, uri);
              photoUrls.push(url);
            }

            await pickupApi.recordPickupAttempt({
              pickup_id: pickup.id,
              status: "failed",
              failure_reason: failureReason,
              failure_notes: failureNotes || null,
              photo_urls: photoUrls,
            });

            Alert.alert("Marked Failed", "Pickup marked as failed.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to record failure");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [pickupId, pickup, failureReason, failureNotes, failurePhotos, router]);

  const openMaps = () => {
    if (!pickup) return;
    const { pickup_latitude: lat, pickup_longitude: lng, pickup_address } =
      pickup;
    if (lat && lng) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      );
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup_address)}`,
      );
    }
  };

  if (!pickup) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Pickup Details Header */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.orderHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pickup #{pickup.pickup_number}
            </Text>
            <View
              style={[
                styles.returnBadge,
                { backgroundColor: colors.warning + "20" },
              ]}
            >
              <Text style={[styles.returnBadgeText, { color: colors.warning }]}>
                RETURN
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {pickup.customer_name}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${pickup.customer_phone}`)}
            >
              <Ionicons name="call" size={20} color={colors.tint} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.detailRow} onPress={openMaps}>
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.detailText, { color: colors.text }]}
              numberOfLines={2}
            >
              {pickup.pickup_address}
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.tint} />
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Ionicons
              name="cube-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {pickup.product_description}
            </Text>
          </View>

          {pickup.return_reason && (
            <View
              style={[
                styles.reasonBanner,
                { backgroundColor: colors.error + "10" },
              ]}
            >
              <Ionicons
                name="return-down-back"
                size={18}
                color={colors.error}
              />
              <Text style={[styles.reasonBannerText, { color: colors.error }]}>
                Reason: {pickup.return_reason}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.navigateButton,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
              },
            ]}
            onPress={openMaps}
          >
            <Ionicons name="navigate" size={18} color={colors.tint} />
            <Text style={[styles.navigateText, { color: colors.tint }]}>
              Navigate
            </Text>
          </TouchableOpacity>
        </View>

        {/* Phase 1: Arrive */}
        {phase === "arrive" && (
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

        {/* Phase 2: OTP */}
        {phase === "otp" && (
          <>
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                OTP Verification
              </Text>

              {!otpSent ? (
                <TouchableOpacity
                  style={[
                    styles.otpSendButton,
                    { backgroundColor: colors.tint },
                  ]}
                  onPress={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.otpSendText}>
                      Send OTP to Customer
                    </Text>
                  )}
                </TouchableOpacity>
              ) : !otpVerified ? (
                <View style={styles.otpInputSection}>
                  <TextInput
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
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
                      <Text
                        style={[
                          styles.resendText,
                          {
                            color:
                              resendTimer > 0
                                ? colors.textSecondary
                                : colors.tint,
                          },
                        ]}
                      >
                        {resendTimer > 0
                          ? `Resend in ${resendTimer}s`
                          : "Resend OTP"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.verifyButton,
                        {
                          backgroundColor:
                            otpCode.length === 6 ? colors.tint : colors.border,
                        },
                      ]}
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
                <View
                  style={[
                    styles.otpVerifiedBanner,
                    { backgroundColor: colors.success + "15" },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.otpVerifiedText, { color: colors.success }]}
                  >
                    OTP Verified
                  </Text>
                </View>
              )}
            </View>

            {/* Outcome choice after OTP (or skip OTP) */}
            <View style={styles.pathChoice}>
              <Text style={[styles.pathTitle, { color: colors.text }]}>
                Pickup Outcome
              </Text>
              <View style={styles.pathButtons}>
                <TouchableOpacity
                  style={[
                    styles.pathButton,
                    { backgroundColor: colors.success },
                  ]}
                  onPress={() => {
                    if (!otpVerified) {
                      Alert.alert(
                        "OTP Not Verified",
                        "Please verify OTP before collecting the item.",
                      );
                      return;
                    }
                    setPhase("collect");
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={28}
                    color="#FFFFFF"
                  />
                  <Text style={styles.pathButtonText}>Collect</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pathButton,
                    { backgroundColor: colors.error },
                  ]}
                  onPress={() => setPhase("failed")}
                >
                  <Ionicons name="close-circle" size={28} color="#FFFFFF" />
                  <Text style={styles.pathButtonText}>Failed</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Phase 3: Collect Item */}
        {phase === "collect" && (
          <>
            {/* Item Condition */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Item Condition
              </Text>
              {ITEM_CONDITIONS.map((condition) => (
                <TouchableOpacity
                  key={condition.value}
                  style={[
                    styles.conditionOption,
                    {
                      borderColor:
                        itemCondition === condition.value
                          ? colors.tint
                          : colors.border,
                      backgroundColor:
                        itemCondition === condition.value
                          ? colors.tint + "10"
                          : "transparent",
                    },
                  ]}
                  onPress={() => setItemCondition(condition.value)}
                >
                  <Ionicons
                    name={
                      itemCondition === condition.value
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={22}
                    color={
                      itemCondition === condition.value
                        ? colors.tint
                        : colors.textSecondary
                    }
                  />
                  <Text style={[styles.conditionText, { color: colors.text }]}>
                    {condition.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Condition Photos (min 2, max 5) */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Item Condition Photos (min 2)
              </Text>
              <PhotoCapture
                photos={conditionPhotos}
                onPhotosChange={setConditionPhotos}
                maxPhotos={5}
                colors={colors as any}
              />
            </View>

            {/* Condition Notes */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Condition Notes (Optional)
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
                placeholder="Describe the item condition..."
                placeholderTextColor={colors.textSecondary}
                value={conditionNotes}
                onChangeText={setConditionNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Customer Signature */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Customer Signature (Optional)
              </Text>
              {signature ? (
                <View style={styles.signaturePreview}>
                  <View
                    style={[
                      styles.signatureBox,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.signatureText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Signature captured
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.success}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.changeButton,
                      { borderColor: colors.tint },
                    ]}
                    onPress={() => setShowSignature(true)}
                  >
                    <Text
                      style={[
                        styles.changeButtonText,
                        { color: colors.tint },
                      ]}
                    >
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.signatureButton,
                    { borderColor: colors.tint },
                  ]}
                  onPress={() => setShowSignature(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={24}
                    color={colors.tint}
                  />
                  <Text
                    style={[
                      styles.signatureButtonText,
                      { color: colors.tint },
                    ]}
                  >
                    Capture Signature
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Failed Path */}
        {phase === "failed" && (
          <>
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Failure Reason
              </Text>
              {PICKUP_FAILURE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.conditionOption,
                    {
                      borderColor:
                        failureReason === reason.value
                          ? colors.error
                          : colors.border,
                      backgroundColor:
                        failureReason === reason.value
                          ? colors.error + "10"
                          : "transparent",
                    },
                  ]}
                  onPress={() => setFailureReason(reason.value)}
                >
                  <Ionicons
                    name={
                      failureReason === reason.value
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={22}
                    color={
                      failureReason === reason.value
                        ? colors.error
                        : colors.textSecondary
                    }
                  />
                  <Text style={[styles.conditionText, { color: colors.text }]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Notes{" "}
                {failureReason === "other" ? "(Required)" : "(Optional)"}
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
      {phase === "collect" && (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.completeButton,
              {
                backgroundColor:
                  itemCondition && conditionPhotos.length >= 2
                    ? colors.success
                    : colors.border,
              },
            ]}
            onPress={handleCompletePickup}
            disabled={
              !itemCondition || conditionPhotos.length < 2 || submitting
            }
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Confirm Pickup</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {phase === "failed" && (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.failButton,
              {
                backgroundColor: failureReason ? colors.error : colors.border,
              },
            ]}
            onPress={handleFailPickup}
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
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "600",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  returnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  returnBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  reasonBannerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  navigateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  arriveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 14,
    gap: 10,
  },
  arriveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  pathChoice: {
    gap: 12,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  pathButtons: {
    flexDirection: "row",
    gap: 12,
  },
  pathButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 14,
    gap: 8,
  },
  pathButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  otpSendButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
  },
  otpSendText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  otpInputSection: {
    gap: 10,
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "600",
  },
  otpActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    fontWeight: "500",
  },
  verifyButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  verifyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  otpVerifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  otpVerifiedText: {
    fontSize: 15,
    fontWeight: "600",
  },
  conditionOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  conditionText: {
    fontSize: 15,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  signaturePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontWeight: "500",
  },
  signatureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    gap: 8,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  failButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
