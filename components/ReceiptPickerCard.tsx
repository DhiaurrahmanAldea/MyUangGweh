import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteReceiptImageQuietly, persistReceiptImage } from '../utils/receipt';
import {
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useReduceMotion,
} from '../utils/theme';

export interface ReceiptPickerCardProps {
  readonly receiptUri: string | null;
  readonly onChangeReceiptUri: (uri: string | null) => void;
  readonly error?: string;
}

type ImageSourceKind = 'library' | 'camera';

export function ReceiptPickerCard({
  receiptUri,
  onChangeReceiptUri,
  error,
}: ReceiptPickerCardProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setHasImageError(false);
    if (receiptUri === null) {
      setViewerVisible(false);
    }
  }, [receiptUri]);

  const pickReceiptFrom = useCallback(
    async (source: ImageSourceKind) => {
      if (isLoading) {
        return;
      }
      Keyboard.dismiss();
      setIsLoading(true);

      try {
        const permission =
          source === 'library'
            ? await ImagePicker.requestMediaLibraryPermissionsAsync()
            : await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            source === 'library'
              ? 'Photo library permission needed'
              : 'Camera permission needed',
            source === 'library'
              ? 'Allow photo library access in your device settings to attach a receipt photo.'
              : 'Allow camera access in your device settings to take a photo of your receipt.',
          );
          return;
        }

        const result =
          source === 'library'
            ? await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.85,
              })
            : await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.85,
              });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];
        if (!asset?.uri) {
          return;
        }

        const persistedUri = await persistReceiptImage(asset.uri);
        if (isMountedRef.current) {
          onChangeReceiptUri(persistedUri);
        } else {
          deleteReceiptImageQuietly(persistedUri);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to attach receipt photo.';
        Alert.alert('Receipt error', message);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isLoading, onChangeReceiptUri],
  );

  const handleReplace = useCallback(() => {
    if (isLoading) {
      return;
    }
    Keyboard.dismiss();
    Alert.alert('Replace receipt', 'Choose how to attach a new receipt photo.', [
      { text: 'Gallery', onPress: () => void pickReceiptFrom('library') },
      { text: 'Camera', onPress: () => void pickReceiptFrom('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [isLoading, pickReceiptFrom]);

  const handleOpenViewer = useCallback(() => {
    if (receiptUri === null) {
      return;
    }
    Keyboard.dismiss();
    setViewerVisible(true);
  }, [receiptUri]);

  const handleCloseViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const handleRemove = useCallback(() => {
    if (isLoading) {
      return;
    }
    onChangeReceiptUri(null);
  }, [isLoading, onChangeReceiptUri]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.negative : theme.colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            theme.typography.caption,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          Receipt (optional)
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : null}
      </View>

      {receiptUri === null ? (
        <>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted },
            ]}
          >
            Attach a photo as proof of purchase.
          </Text>

          <View style={styles.emptyActionsRow}>
            <Pressable
              onPress={() => void pickReceiptFrom('library')}
              disabled={isLoading}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.pickerButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.canvas,
                  borderColor: theme.colors.border,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Choose receipt from gallery"
            >
              <Ionicons
                name="images-outline"
                size={18}
                color={theme.colors.accent}
              />
              <Text
                style={[
                  theme.typography.bodyStrong,
                  { color: theme.colors.text },
                ]}
              >
                Gallery
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void pickReceiptFrom('camera')}
              disabled={isLoading}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.pickerButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.canvas,
                  borderColor: theme.colors.border,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Take receipt photo with camera"
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={theme.colors.accent}
              />
              <Text
                style={[
                  theme.typography.bodyStrong,
                  { color: theme.colors.text },
                ]}
              >
                Camera
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Pressable
            onPress={handleOpenViewer}
            android_ripple={{ color: theme.colors.ripple }}
            style={({ pressed }) => [
              styles.thumbnailFrame,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.border,
              },
              Platform.OS !== 'android' && pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="View full-screen receipt"
          >
            {hasImageError ? (
              <View style={styles.brokenImageFallback}>
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={theme.colors.textMuted}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Receipt preview unavailable
                </Text>
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: receiptUri }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                  onError={() => setHasImageError(true)}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.zoomPillOverlay,
                    {
                      backgroundColor: theme.colors.modalBackdrop,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <Ionicons
                    name="expand-outline"
                    size={13}
                    color={theme.colors.onModalBackdrop}
                  />
                  <Text
                    style={[
                      theme.typography.micro,
                      { color: theme.colors.onModalBackdrop },
                    ]}
                  >
                    Tap to zoom
                  </Text>
                </View>
              </>
            )}
          </Pressable>

          <View style={styles.attachedActionsRow}>
            <Pressable
              onPress={handleOpenViewer}
              disabled={isLoading}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.attachedActionButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.canvas,
                  borderColor: theme.colors.border,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View receipt"
            >
              <Ionicons
                name="eye-outline"
                size={16}
                color={theme.colors.accent}
              />
              <Text
                style={[
                  theme.typography.caption,
                  styles.attachedActionText,
                  { color: theme.colors.text },
                ]}
              >
                View
              </Text>
            </Pressable>

            <Pressable
              onPress={handleReplace}
              disabled={isLoading}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.attachedActionButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.canvas,
                  borderColor: theme.colors.border,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Replace receipt"
            >
              <Ionicons
                name="images-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  theme.typography.caption,
                  styles.attachedActionText,
                  { color: theme.colors.text },
                ]}
              >
                Replace
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRemove}
              disabled={isLoading}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.attachedActionButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.negativeSoft
                      : theme.colors.surface,
                  borderColor: theme.colors.negativeBorder,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Remove receipt"
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={theme.colors.negative}
              />
              <Text
                style={[
                  theme.typography.caption,
                  styles.attachedActionText,
                  { color: theme.colors.negative },
                ]}
              >
                Remove
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.negative }]}>
          {error}
        </Text>
      ) : null}

      <Modal
        visible={viewerVisible && receiptUri !== null}
        transparent={true}
        animationType={reduceMotion ? 'none' : 'fade'}
        statusBarTranslucent={true}
        onRequestClose={handleCloseViewer}
      >
        <View
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: theme.colors.modalBackdrop,
              paddingTop: insets.top + SPACING.md,
              paddingBottom: insets.bottom + SPACING.lg,
              paddingHorizontal: SPACING.lg,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable
              onPress={handleCloseViewer}
              android_ripple={{
                color: colorWithAlpha(theme.colors.onModalBackdrop, 0.2),
                borderless: true,
                radius: 24,
              }}
              style={({ pressed }) => [
                styles.modalCloseButton,
                Platform.OS !== 'android' && pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close receipt preview"
            >
              <Ionicons
                name="close"
                size={26}
                color={theme.colors.onModalBackdrop}
              />
            </Pressable>
          </View>

          <View style={styles.modalImageContainer}>
            {receiptUri !== null ? (
              <Image
                source={{ uri: receiptUri }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                accessibilityLabel="Receipt photo preview"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  sectionLabel: {
    fontWeight: '600',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: 2,
  },
  pickerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  thumbnailFrame: {
    position: 'relative',
    height: 164,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  zoomPillOverlay: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brokenImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  attachedActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  attachedActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
  },
  attachedActionText: {
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
