import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, layout, SCREEN_PADDING, spacing } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { kycService } from '../../services/apiService';

export const KYCVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [manualNIC, setManualNIC] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await kycService.getKYCStatus();
      if (res?.data?.document) {
        setVerificationResult({
          verificationStatus: res.data.document.VERIFICATION_STATUS || res.data.status,
          extractedData: {
            documentType: res.data.document.DOCUMENT_TYPE || 'NIC',
            nicNumber: res.data.document.DOCUMENT_NUMBER,
            name: res.data.document.EXTRACTED_NAME,
            dateOfBirth: res.data.document.EXTRACTED_DOB,
            gender: res.data.document.EXTRACTED_GENDER,
            ocrConfidence: `${res.data.document.OCR_CONFIDENCE || 0}%`,
          },
          rejectionReason: res.data.document.REJECTION_REASON,
        });
      }
    } catch {
      // User not logged in yet or no prior KYC
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    checkStatus();
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to capture identity documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to select document photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open photo gallery.');
    }
  };

  const handleVerify = async () => {
    if (!selectedImage) {
      Alert.alert('No Image Selected', 'Please take a photo or select an image of your Sri Lankan NIC.');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      const filename = selectedImage.split('/').pop() || 'nic_document.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('document', {
        uri: selectedImage,
        name: filename,
        type: type,
      } as any);

      if (manualNIC.trim()) {
        formData.append('manualNIC', manualNIC.trim());
      }

      const response = await kycService.submitKYC(formData);
      if (response && response.data) {
        setVerificationResult(response.data);
      }
    } catch (err: any) {
      console.error('KYC submission error:', err);
      if (err.data) {
        setVerificationResult(err.data);
      }
      Alert.alert(
        'Verification Notice',
        err.message || 'Failed to communicate with OCR identity verification server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const status = verificationResult?.verificationStatus || 'NOT_SUBMITTED';
  const isVerified = status === 'VERIFIED';
  const isPending = status === 'PENDING';
  const isRejected = status === 'REJECTED';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identity Verification (KYC)</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Tracker */}
        <View style={styles.trackerContainer}>
          <Text style={styles.stepText}>Sri Lankan NIC OCR Pipeline</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                isVerified
                  ? { width: '100%', backgroundColor: colors.accent }
                  : isPending
                  ? { width: '66%', backgroundColor: colors.yellow }
                  : { width: '33%', backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={styles.stepLabel}>
            {isVerified
              ? 'Verification Complete'
              : isPending
              ? 'Pending Review'
              : 'Document Capture & OCR'}
          </Text>
        </View>

        {/* Viewfinder / Image Preview */}
        <View style={styles.viewfinderContainer}>
          {selectedImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.retakePill}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={16} color="#FFF" />
                <Text style={styles.retakeText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.viewfinderBg}>
              <View style={styles.frameOverlay}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                <FontAwesome5
                  name="id-card"
                  size={38}
                  color={colors.accent}
                  style={{ marginBottom: 10 }}
                />
                <Text style={styles.frameText}>
                  Position your Sri Lankan NIC (Old or New format) within the frame
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Camera & Gallery Action Buttons */}
        {!selectedImage && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.captureOptionBtn} onPress={takePhoto} activeOpacity={0.8}>
              <MaterialIcons name="camera-alt" size={22} color={colors.accent} />
              <Text style={styles.captureOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureOptionBtn} onPress={pickImage} activeOpacity={0.8}>
              <MaterialIcons name="photo-library" size={22} color={colors.accent} />
              <Text style={styles.captureOptionText}>From Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Optional Manual NIC Input if OCR needs assistance */}
        {selectedImage && !verificationResult && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>NIC Number (Optional Confirmation)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 199204502391 or 921450239V"
              placeholderTextColor={colors.textSecondary}
              value={manualNIC}
              onChangeText={setManualNIC}
              autoCapitalize="characters"
            />
          </View>
        )}

        {/* Loading Spinner during OCR */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingTitle}>Processing Tesseract OCR...</Text>
            <Text style={styles.loadingSubtitle}>
              Extracting NIC digits, Date of Birth, and Name
            </Text>
          </View>
        )}

        {/* Live Extracted Data Card */}
        {verificationResult && !loading && (
          <Card style={styles.extractionCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>OCR Extraction Results</Text>
              <View
                style={[
                  styles.statusBadge,
                  isVerified
                    ? { backgroundColor: colors.accentMuted }
                    : isRejected
                    ? { backgroundColor: colors.red + '33' }
                    : { backgroundColor: colors.yellow + '33' },
                ]}
              >
                <MaterialIcons
                  name={isVerified ? 'verified' : isRejected ? 'cancel' : 'pending-actions'}
                  size={14}
                  color={isVerified ? colors.accent : isRejected ? colors.red : colors.yellow}
                />
                <Text
                  style={[
                    styles.statusText,
                    isVerified
                      ? { color: colors.accent }
                      : isRejected
                      ? { color: colors.red }
                      : { color: colors.yellow },
                  ]}
                >
                  {status}
                </Text>
              </View>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>DOCUMENT TYPE:</Text>
              <Text style={styles.dataValue}>
                {verificationResult.extractedData?.documentType || 'Sri Lankan NIC'}
              </Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>NIC NUMBER:</Text>
              <Text style={[styles.dataValue, { color: colors.accent }]}>
                {verificationResult.extractedData?.nicNumber || 'Not Detected'}
              </Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>EXTRACTED NAME:</Text>
              <Text style={styles.dataValue}>
                {verificationResult.extractedData?.name || '---'}
              </Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>DATE OF BIRTH (DERIVED):</Text>
              <Text style={styles.dataValue}>
                {verificationResult.extractedData?.dateOfBirth || '---'}
              </Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>GENDER (DERIVED):</Text>
              <Text style={styles.dataValue}>
                {verificationResult.extractedData?.gender || '---'}
              </Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>OCR CONFIDENCE:</Text>
              <Text style={styles.dataValue}>
                {verificationResult.extractedData?.ocrConfidence || 'N/A'}
              </Text>
            </View>

            {verificationResult.rejectionReason && (
              <View style={styles.rejectionBox}>
                <MaterialIcons
                  name="info"
                  size={16}
                  color={isRejected ? colors.red : colors.yellow}
                />
                <Text
                  style={[
                    styles.rejectionText,
                    isRejected ? { color: colors.red } : { color: colors.yellow },
                  ]}
                >
                  {verificationResult.rejectionReason}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Action Button */}
        {selectedImage && !verificationResult && !loading && (
          <PrimaryButton
            title="Submit for OCR Verification →"
            onPress={handleVerify}
            style={{ marginTop: 8 }}
          />
        )}

        {verificationResult && (
          <PrimaryButton
            title={isVerified ? 'Continue to Trading Dashboard →' : 'Done'}
            onPress={() => navigation.navigate('MainApp')}
            style={{ marginTop: 8 }}
          />
        )}

        {isRejected && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setSelectedImage(null);
              setVerificationResult(null);
            }}
          >
            <Text style={styles.retryBtnText}>Resubmit Identity Document</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 18,
    color: '#FFF',
  },
  trackerContainer: {
    marginBottom: spacing.m,
  },
  stepText: {
    ...typography.label,
    fontSize: 10,
    marginBottom: 6,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  stepLabel: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  viewfinderContainer: {
    height: 220,
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewfinderBg: {
    flex: 1,
    backgroundColor: '#131915',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  retakePill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  retakeText: {
    ...typography.bodySmall,
    color: '#FFF',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  frameOverlay: {
    width: '85%',
    height: '75%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  frameText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '85%',
    fontSize: 11,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  captureOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgInput,
    paddingVertical: 12,
    borderRadius: layout.borderRadius,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  captureOptionText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: spacing.m,
  },
  inputLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 13,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.l,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    marginBottom: spacing.m,
  },
  loadingTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 10,
  },
  loadingSubtitle: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  extractionCard: {
    marginBottom: spacing.m,
    padding: spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  dataValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 12,
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  rejectionText: {
    ...typography.bodySmall,
    fontSize: 11,
    flex: 1,
    marginLeft: 8,
    lineHeight: 16,
  },
  retryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

