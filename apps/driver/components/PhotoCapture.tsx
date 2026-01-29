import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    tint: string;
    border: string;
    error: string;
  };
}

export function PhotoCapture({
  photos,
  onPhotosChange,
  maxPhotos = 3,
  colors,
}: PhotoCaptureProps) {
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access to take proof of delivery photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert(
        'Maximum Photos',
        `You can only add up to ${maxPhotos} photos.`
      );
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photoUri = asset.uri;
        onPhotosChange([...photos, photoUri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert(
        'Maximum Photos',
        `You can only add up to ${maxPhotos} photos.`
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to select photos.'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;
        onPhotosChange([...photos, photoUri]);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const newPhotos = [...photos];
          newPhotos.splice(index, 1);
          onPhotosChange(newPhotos);
        },
      },
    ]);
  };

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Proof of Delivery Photos
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {photos.length}/{maxPhotos} photos
        </Text>
      </View>

      <View style={styles.photosContainer}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: colors.error }]}
              onPress={() => removePhoto(index)}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < maxPhotos && (
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={showPhotoOptions}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <>
                <Ionicons name="camera" size={32} color={colors.tint} />
                <Text style={[styles.addButtonText, { color: colors.tint }]}>
                  Add Photo
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tips}>
        <Ionicons
          name="bulb-outline"
          size={16}
          color={colors.textSecondary}
        />
        <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
          Take a clear photo of the delivered package at the customer's door
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  tipsText: {
    flex: 1,
    fontSize: 13,
  },
});
