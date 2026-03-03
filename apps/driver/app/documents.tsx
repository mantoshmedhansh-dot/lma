import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/lib/store/auth";
import { useThemeColors } from "@/hooks/useThemeColor";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api/client";

interface DocumentItem {
  type: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: "not_uploaded" | "uploaded" | "verified";
  url?: string;
  uploaded_at?: string;
}

const DOCUMENT_TYPES: Omit<DocumentItem, "status">[] = [
  {
    type: "driving_license",
    label: "Driving License",
    icon: "card-outline",
  },
  {
    type: "vehicle_rc",
    label: "Vehicle Registration (RC)",
    icon: "car-outline",
  },
  {
    type: "insurance",
    label: "Insurance Document",
    icon: "shield-checkmark-outline",
  },
  {
    type: "id_proof",
    label: "ID Proof (Aadhaar/PAN)",
    icon: "person-outline",
  },
];

const STATUS_CONFIG = {
  not_uploaded: { label: "Not Uploaded", color: "#9CA3AF", bg: "#F3F4F6" },
  uploaded: { label: "Uploaded", color: "#F59E0B", bg: "#FEF3C7" },
  verified: { label: "Verified", color: "#059669", bg: "#D1FAE5" },
};

export default function DocumentsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { driver } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!driver) return;

    try {
      const res = await apiClient<{ documents: Record<string, any> }>(
        "/api/v1/delivery/my-documents",
      );
      const savedDocs = res.documents || {};

      setDocuments(
        DOCUMENT_TYPES.map((dt) => ({
          ...dt,
          status: savedDocs[dt.type]?.status || "not_uploaded",
          url: savedDocs[dt.type]?.url,
          uploaded_at: savedDocs[dt.type]?.uploaded_at,
        })),
      );
    } catch {
      // If endpoint fails, show all as not uploaded
      setDocuments(
        DOCUMENT_TYPES.map((dt) => ({ ...dt, status: "not_uploaded" as const })),
      );
    } finally {
      setLoading(false);
    }
  }, [driver]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (docType: string) => {
    if (!driver) return;

    Alert.alert("Upload Document", "Choose an option", [
      {
        text: "Take Photo",
        onPress: () => captureDocument(docType, "camera"),
      },
      {
        text: "Choose from Gallery",
        onPress: () => captureDocument(docType, "gallery"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const captureDocument = async (
    docType: string,
    source: "camera" | "gallery",
  ) => {
    if (!driver) return;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera access is needed.");
        return;
      }
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Photo library access is needed.");
        return;
      }
    }

    setUploading(docType);

    try {
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            });

      if (result.canceled || !result.assets[0]) {
        setUploading(null);
        return;
      }

      const uri = result.assets[0].uri;
      const fileName = `${Date.now()}_${docType}.jpg`;
      const filePath = `driver-documents/${driver.id}/${fileName}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("deliveries")
        .upload(filePath, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("deliveries")
        .getPublicUrl(filePath);

      // Save metadata via API
      await apiClient("/api/v1/delivery/documents", {
        method: "POST",
        body: JSON.stringify({
          doc_type: docType,
          url: urlData.publicUrl,
        }),
      });

      Alert.alert("Success", "Document uploaded successfully.");
      fetchDocuments();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upload document.");
    } finally {
      setUploading(null);
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Upload your documents for verification. All documents are securely
        stored.
      </Text>

      {documents.map((doc) => {
        const statusConfig = STATUS_CONFIG[doc.status];
        const isUploading = uploading === doc.type;

        return (
          <TouchableOpacity
            key={doc.type}
            style={[
              styles.docCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => uploadDocument(doc.type)}
            disabled={isUploading}
          >
            <View style={styles.docLeft}>
              <View
                style={[
                  styles.docIcon,
                  { backgroundColor: colors.tintLight || "#EEF2FF" },
                ]}
              >
                <Ionicons name={doc.icon} size={24} color={colors.tint} />
              </View>
              <View style={styles.docInfo}>
                <Text style={[styles.docLabel, { color: colors.text }]}>
                  {doc.label}
                </Text>
                <View style={styles.docStatusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusConfig.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusConfig.color },
                      ]}
                    >
                      {statusConfig.label}
                    </Text>
                  </View>
                  {doc.uploaded_at && (
                    <Text
                      style={[
                        styles.uploadDate,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.docRight}>
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Ionicons
                  name={
                    doc.status === "not_uploaded"
                      ? "cloud-upload-outline"
                      : "refresh-outline"
                  }
                  size={22}
                  color={colors.tint}
                />
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.infoBox}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.textSecondary}
        />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Documents will be verified by your hub manager within 24-48 hours.
          You&apos;ll be notified once verified.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  docLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: { flex: 1, gap: 4 },
  docLabel: { fontSize: 15, fontWeight: "600" },
  docStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "600" },
  uploadDate: { fontSize: 11 },
  docRight: { paddingLeft: 8 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
