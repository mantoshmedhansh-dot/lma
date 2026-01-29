import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';

interface SignatureCaptureProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    tint: string;
    border: string;
  };
}

export function SignatureCapture({
  visible,
  onClose,
  onSave,
  colors,
}: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setIsEmpty(true);
  };

  const handleSave = () => {
    signatureRef.current?.readSignature();
  };

  const handleSignature = (signature: string) => {
    if (signature) {
      onSave(signature);
      onClose();
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  const webStyle = `.m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body, html {
    background-color: ${colors.card};
  }`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Customer Signature
          </Text>
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={[styles.clearText, { color: colors.tint }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructions}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Ask the customer to sign below to confirm delivery
          </Text>
        </View>

        <View
          style={[
            styles.signatureContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleSignature}
            onBegin={handleBegin}
            onEmpty={() => setIsEmpty(true)}
            webStyle={webStyle}
            backgroundColor={colors.card}
            penColor={colors.text}
            dotSize={2}
            minWidth={1.5}
            maxWidth={3}
            style={styles.signature}
          />
        </View>

        {isEmpty && (
          <View style={styles.placeholderContainer}>
            <Ionicons
              name="create-outline"
              size={32}
              color={colors.textSecondary}
            />
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              Sign here
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: isEmpty ? colors.border : colors.tint },
            ]}
            onPress={handleSave}
            disabled={isEmpty}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Confirm Signature</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '500',
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
  },
  signatureContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  signature: {
    flex: 1,
    width: '100%',
    height: height * 0.4,
  },
  placeholderContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  placeholderText: {
    fontSize: 16,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
