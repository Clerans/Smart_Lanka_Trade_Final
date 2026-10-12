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
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [manualNIC, setManualNIC] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await kycService.getKYCStatus();
      if (res?.data?.document) {
        const doc = res.data.document;
        setVerificationResult({
          verificationStatus: doc.VERIFICATION_STATUS || doc.verificationStatus || res.data.status,
          extractedData: {
            documentType: doc.DOCUMENT_TYPE || doc.documentType || 'NIC',
            nicNumber: doc.DOCUMENT_NUMBER || doc.documentNumber,
            name: doc.EXTRACTED_NAME || doc.extractedName,
            dateOfBirth: doc.EXTRACTED_DOB || doc.extractedDob,
            gender: doc.EXTRACTED_GENDER || doc.extractedGender,
            ocrConfidence: `${doc.OCR_CONFIDENCE || doc.confidence || 0}%`,
          },
          rejectionReason: doc.REJECTION_REASON || doc.rejectionReason,
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

  const handleImageCaptured = (uri: string) => {
    if (activeSide === 'front') {
      setFrontImage(uri);
      // If back side isn't captured yet, prompt switch to back side
      if (!backImage) {
        setActiveSide('back');
      }
    } else {
      setBackImage(uri);
    }
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
        handleImageCaptured(result.assets[0].uri);
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
        handleImageCaptured(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open photo gallery.');
    }
  };

  const clearActiveImage = () => {
    if (activeSide === 'front') {
      setFrontImage(null);
    } else {
      setBackImage(null);
    }
  };

  const handleVerify = async () => {
    if (!frontImage && !backImage) {
      Alert.alert('No Document Selected', 'Please capture or select the Front Side of your Sri Lankan NIC.');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      if (frontImage) {
        const filename = frontImage.split('/').pop() || 'front_nic.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('document', {
          uri: frontImage,
          name: filename,
          type: type,
        } as any);
      }

      if (backImage) {
        const backFilename = backImage.split('/').pop() || 'back_nic.jpg';
        const backMatch = /\.(\w+)$/.exec(backFilename);
        const backType = backMatch ? `image/${backMatch[1]}` : 'image/jpeg';
        formData.append('backDocument', {
          uri: backImage,
          name: backFilename,
          type: backType,
        } as any);
      }

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

  const currentImage = activeSide === 'front' ? frontImage : backImage;
  const hasAnyImage = !!(frontImage || backImage);

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
          <Text style={styles.stepText}>SRI LANKAN NIC OCR PIPELINE</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                isVerified
                  ? { width: '100%', backgroundColor: colors.accent }
                  : isPending
                  ? { width: '66%', backgroundColor: colors.yellow }
                  : { width: hasAnyImage ? '50%' : '25%', backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={styles.stepLabel}>
            {isVerified
              ? 'Verification Complete'
              : isPending
              ? 'Pending Review'
              : hasAnyImage
              ? 'Ready for OCR Verification'
              : 'Capture NIC Front & Back'}
          </Text>
        </View>

        {/* Old NIC Explanation Banner */}
        {!verificationResult && (
          <View style={styles.infoBanner}>
            <MaterialIcons name="info-outline" size={20} color={colors.accent} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.infoBannerTitle}>Old Sri Lankan NIC Format?</Text>
              <Text style={styles.infoBannerText}>
                In 9-digit Old NICs (e.g. 921453289V), the NIC number is on the <Text style={{ fontWeight: '700', color: '#FFF' }}>Front</Text> and your Full Name is on the <Text style={{ fontWeight: '700', color: '#FFF' }}>Back</Text>. Upload both sides for automatic verification!
              </Text>
            </View>
          </View>
        )}

        {/* Dual Side Selector Tabs */}
        {!verificationResult && (
          <View style={styles.sideTabContainer}>
            <TouchableOpacity
              style={[styles.sideTab, activeSide === 'front' && styles.sideTabActive]}
              onPress={() => setActiveSide('front')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="badge"
                size={18}
                color={activeSide === 'front' ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.sideTabText, activeSide === 'front' && styles.sideTabTextActive]}>
                Front Side
              </Text>
              {frontImage ? (
                <MaterialIcons name="check-circle" size={16} color={colors.accent} style={{ marginLeft: 6 }} />
              ) : (
                <View style={styles.requiredPill}>
                  <Text style={styles.requiredPillText}>Photo & NIC</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sideTab, activeSide === 'back' && styles.sideTabActive]}
              onPress={() => setActiveSide('back')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="flip"
                size={18}
                color={activeSide === 'back' ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.sideTabText, activeSide === 'back' && styles.sideTabTextActive]}>
                Back Side
              </Text>
              {backImage ? (
                <MaterialIcons name="check-circle" size={16} color={colors.accent} style={{ marginLeft: 6 }} />
              ) : (
                <View style={styles.oldNicPill}>
                  <Text style={styles.oldNicPillText}>Old NIC Name</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Viewfinder / Image Preview for Active Side */}
        {!verificationResult && (
          <View style={styles.viewfinderContainer}>
            {currentImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: currentImage }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewTagPill}>
                  <Text style={styles.previewTagText}>
                    {activeSide === 'front' ? 'FRONT SIDE' : 'BACK SIDE'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.retakePill}
                  onPress={clearActiveImage}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={16} color="#FFF" />
                  <Text style={styles.retakeText}>Retake {activeSide === 'front' ? 'Front' : 'Back'}</Text>
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
                    name={activeSide === 'front' ? 'id-card' : 'file-signature'}
                    size={38}
                    color={colors.accent}
                    style={{ marginBottom: 10 }}
                  />
                  <Text style={styles.frameTitle}>
                    {activeSide === 'front' ? 'FRONT OF SRI LANKAN NIC' : 'BACK OF SRI LANKAN NIC'}
                  </Text>
                  <Text style={styles.frameText}>
                    {activeSide === 'front'
                      ? 'Position the Front within frame (NIC Number & Photograph)'
                      : 'Position the Back within frame (Cardholder Full Name & Details)'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Camera & Gallery Action Buttons */}
        {!verificationResult && !currentImage && (
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

        {/* Dual Slot Quick Overview Cards */}
        {!verificationResult && (
          <View style={styles.slotsRow}>
            <TouchableOpacity
              style={[
                styles.slotCard,
                activeSide === 'front' && styles.slotCardActive,
                frontImage ? styles.slotCardCaptured : null
              ]}
              onPress={() => setActiveSide('front')}
              activeOpacity={0.8}
            >
              <View style={styles.slotHeader}>
                <Text style={styles.slotTitle}>1. Front Side</Text>
                <MaterialIcons
                  name={frontImage ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={frontImage ? colors.accent : colors.textSecondary}
                />
              </View>
              {frontImage ? (
                <Image source={{ uri: frontImage }} style={styles.slotThumb} />
              ) : (
                <View style={styles.slotEmpty}>
                  <MaterialIcons name="camera-alt" size={20} color={colors.textSecondary} />
                  <Text style={styles.slotEmptyText}>Tap to add</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.slotCard,
                activeSide === 'back' && styles.slotCardActive,
                backImage ? styles.slotCardCaptured : null
              ]}
              onPress={() => setActiveSide('back')}
              activeOpacity={0.8}
            >
              <View style={styles.slotHeader}>
                <Text style={styles.slotTitle}>2. Back Side</Text>
                <MaterialIcons
                  name={backImage ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={backImage ? colors.accent : colors.textSecondary}
                />
              </View>
              {backImage ? (
                <Image source={{ uri: backImage }} style={styles.slotThumb} />
              ) : (
                <View style={styles.slotEmpty}>
                  <MaterialIcons name="flip" size={20} color={colors.textSecondary} />
                  <Text style={styles.slotEmptyText}>Old NIC Name</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Optional Manual NIC Input if OCR needs assistance */}
        {hasAnyImage && !verificationResult && (
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
            <Text style={styles.loadingTitle}>Processing Dual-Side Tesseract OCR...</Text>
            <Text style={styles.loadingSubtitle}>
              Extracting NIC digits, Full Name, and Date of Birth
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
        {hasAnyImage && !verificationResult && !loading && (
          <PrimaryButton
            title={
              frontImage && backImage
                ? 'Verify Front & Back Sides →'
                : 'Submit for OCR Verification →'
            }
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
              setFrontImage(null);
              setBackImage(null);
              setActiveSide('front');
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0D2218',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1B4332',
    marginBottom: spacing.m,
  },
  infoBannerTitle: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBannerText: {
    ...typography.bodySmall,
    color: '#A3C2B3',
    fontSize: 11,
    lineHeight: 16,
  },
  sideTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#161D19',
    padding: 4,
    borderRadius: 12,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  sideTabActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  sideTabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 6,
  },
  sideTabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  requiredPill: {
    backgroundColor: colors.accent + '25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  requiredPillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
  },
  oldNicPill: {
    backgroundColor: colors.yellow + '25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  oldNicPillText: {
    color: colors.yellow,
    fontSize: 9,
    fontWeight: '700',
  },
  previewTagPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewTagText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  frameTitle: {
    ...typography.label,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  slotsRow: {
    flexDirection: 'row',
    marginBottom: spacing.m,
  },
  slotCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: 10,
    borderRadius: layout.borderRadius,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotCardActive: {
    borderColor: colors.accent,
  },
  slotCardCaptured: {
    borderColor: colors.accent + '66',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
    fontSize: 11,
  },
  slotThumb: {
    width: '100%',
    height: 60,
    borderRadius: 6,
  },
  slotEmpty: {
    width: '100%',
    height: 60,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
  },
  slotEmptyText: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
