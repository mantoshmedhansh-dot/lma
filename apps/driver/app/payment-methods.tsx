import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/lib/store/auth";
import { useThemeColors } from "@/hooks/useThemeColor";
import { apiClient } from "@/lib/api/client";

interface PaymentInfo {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  upi_id: string;
}

const EMPTY_INFO: PaymentInfo = {
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  account_holder_name: "",
  upi_id: "",
};

export default function PaymentMethodsScreen() {
  const colors = useThemeColors();
  const { driver } = useAuthStore();
  const [info, setInfo] = useState<PaymentInfo>(EMPTY_INFO);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    fetchPaymentInfo();
  }, []);

  const fetchPaymentInfo = async () => {
    try {
      const res = await apiClient<{ payment_info: PaymentInfo | null }>(
        "/api/v1/delivery/payment-info",
      );
      if (res.payment_info) {
        setInfo(res.payment_info);
        setHasSaved(true);
      } else {
        setEditing(true);
      }
    } catch {
      setEditing(true);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string | null => {
    if (!info.bank_name.trim()) return "Bank name is required";
    if (!info.account_number.trim()) return "Account number is required";
    if (!info.ifsc_code.trim()) return "IFSC code is required";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(info.ifsc_code.trim()))
      return "Invalid IFSC code format";
    if (!info.account_holder_name.trim())
      return "Account holder name is required";
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert("Validation Error", error);
      return;
    }

    setSaving(true);
    try {
      await apiClient("/api/v1/delivery/payment-info", {
        method: "PUT",
        body: JSON.stringify({
          bank_name: info.bank_name.trim(),
          account_number: info.account_number.trim(),
          ifsc_code: info.ifsc_code.trim().toUpperCase(),
          account_holder_name: info.account_holder_name.trim(),
          upi_id: info.upi_id.trim() || null,
        }),
      });
      setEditing(false);
      setHasSaved(true);
      Alert.alert("Success", "Payment information saved.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save payment info.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const renderField = (
    label: string,
    key: keyof PaymentInfo,
    placeholder: string,
    options?: {
      keyboardType?: "default" | "numeric";
      autoCapitalize?: "none" | "characters" | "words";
      optional?: boolean;
    },
  ) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
        {options?.optional ? " (Optional)" : ""}
      </Text>
      {editing ? (
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          value={info[key]}
          onChangeText={(text) => setInfo((prev) => ({ ...prev, [key]: text }))}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={options?.keyboardType || "default"}
          autoCapitalize={options?.autoCapitalize || "words"}
        />
      ) : (
        <Text style={[styles.fieldValue, { color: colors.text }]}>
          {info[key] || "-"}
        </Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Add your bank account details for receiving delivery earnings payouts.
        </Text>

        <View
          style={[
            styles.formCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.formHeader}>
            <View style={styles.formHeaderLeft}>
              <Ionicons name="card-outline" size={22} color={colors.tint} />
              <Text style={[styles.formTitle, { color: colors.text }]}>
                Bank Account Details
              </Text>
            </View>
            {hasSaved && !editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={22} color={colors.tint} />
              </TouchableOpacity>
            )}
          </View>

          {renderField("Bank Name", "bank_name", "e.g., State Bank of India")}
          {renderField("Account Number", "account_number", "e.g., 1234567890", {
            keyboardType: "numeric",
            autoCapitalize: "none",
          })}
          {renderField("IFSC Code", "ifsc_code", "e.g., SBIN0001234", {
            autoCapitalize: "characters",
          })}
          {renderField(
            "Account Holder Name",
            "account_holder_name",
            "As per bank records",
          )}
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.formHeader}>
            <View style={styles.formHeaderLeft}>
              <Ionicons name="wallet-outline" size={22} color={colors.tint} />
              <Text style={[styles.formTitle, { color: colors.text }]}>
                UPI Details
              </Text>
            </View>
          </View>
          {renderField("UPI ID", "upi_id", "e.g., name@upi", {
            autoCapitalize: "none",
            optional: true,
          })}
        </View>

        {editing && (
          <View style={styles.buttonRow}>
            {hasSaved && (
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setEditing(false);
                  fetchPaymentInfo();
                }}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.tint,
                  flex: hasSaved ? 1 : undefined,
                },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save Payment Info</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your payment information is encrypted and securely stored. It will
            only be used for processing your delivery earnings payouts.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  formCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 16 },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  formTitle: { fontSize: 16, fontWeight: "600" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "500" },
  fieldValue: { fontSize: 15, fontWeight: "500", paddingVertical: 4 },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontWeight: "600" },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
