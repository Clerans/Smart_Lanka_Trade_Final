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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, layout, SCREEN_PADDING, spacing } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { kycService } from '../../services/apiService';

type FlowStep = 'CAPTURE' | 'EXTRACTING' | 'REVIEW' | 'RESULT';
type DocumentType = 'NIC' | 'DRIVING_LICENCE';

export const KYCVerificationScreen = () => {
  const navigation = useNavigation<any>();

  // Flow State
  const [flowStep, setFlowStep] = useState<FlowStep>('CAPTURE');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('NIC');
  const [refreshing, setRefreshing] = useState(false);

  // Capture State
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Extraction State
  const [extractedInfo, setExtractedInfo] = useState<{
    documentId: number;
    documentType: string;
    ocrConfidence: string;
    rawOcrText: string;
    fieldSources: Record<string, string>;
    hasBackSide: boolean;
  } | null>(null);

  // Review & Editable Fields State
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [address, setAddress] = useState('');
  const [nicNumber, setNicNumber] = useState('');
  const [licenceCategory, setLicenceCategory] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // UI / Collapsible & Errors
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  // Final Backend Verification Result
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Check existing user KYC status on load
  const checkStatus = useCallback(async () => {
    try {
      const res = await kycService.getKYCStatus();
      if (res?.data?.document) {
        const doc = res.data.document;
        const status = doc.VERIFICATION_STATUS || doc.verificationStatus || res.data.status;
        
        // If already submitted and processed into VERIFIED, PENDING, or REJECTED
        if (['VERIFIED', 'PENDING', 'REJECTED'].includes(status)) {
          setVerificationResult({
            verificationStatus: status,
            extractedData: {
              documentType: doc.DOCUMENT_TYPE || doc.documentType || 'NIC',
              nicNumber: doc.DOCUMENT_NUMBER || doc.documentNumber,
              name: doc.CONFIRMED_NAME || doc.EXTRACTED_NAME || doc.extractedName,
              dateOfBirth: doc.CONFIRMED_DOB || doc.EXTRACTED_DOB || doc.extractedDob,
              gender: doc.CONFIRMED_GENDER || doc.EXTRACTED_GENDER || doc.extractedGender,
              ocrConfidence: `${doc.OCR_CONFIDENCE || doc.confidence || 0}%`,
            },
            confirmedData: doc.confirmedData,
            rejectionReason: doc.REJECTION_REASON || doc.rejectionReason,
          });
          setFlowStep('RESULT');
        }
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

  // Image handling
  const handleImageCaptured = (uri: string) => {
    if (activeSide === 'front') {
      setFrontImage(uri);
      if (!backImage && selectedDocType === 'NIC') {
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
        quality: 0.85,
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
        quality: 0.85,
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

  // Stage B: Trigger OCR Extraction (Does NOT verify)
  const handleExtractOCR = async () => {
    if (!frontImage && !backImage) {
      Alert.alert('No Document Selected', 'Please capture or select the document photo to proceed.');
      return;
    }

    try {
      setFlowStep('EXTRACTING');

      const formData = new FormData();
      formData.append('documentType', selectedDocType);

      if (frontImage) {
        const filename = frontImage.split('/').pop() || 'front_doc.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('document', {
          uri: frontImage,
          name: filename,
          type: type,
        } as any);
      }

      if (backImage) {
        const backFilename = backImage.split('/').pop() || 'back_doc.jpg';
        const backMatch = /\.(\w+)$/.exec(backFilename);
        const backType = backMatch ? `image/${backMatch[1]}` : 'image/jpeg';
        formData.append('backDocument', {
          uri: backImage,
          name: backFilename,
          type: backType,
        } as any);
      }

      const response = await kycService.extractDocument(formData);
      if (response && response.data) {
        const data = response.data;
        const fields = data.extractedFields || {};

        setExtractedInfo({
          documentId: data.documentId,
          documentType: data.documentType,
          ocrConfidence: data.ocrConfidence,
          rawOcrText: data.rawOcrText || '',
          fieldSources: data.fieldSources || {},
          hasBackSide: data.hasBackSide || false,
        });

        // Prepopulate editable form fields with actual OCR extraction results
        setDocNumber(fields.documentNumber || fields.licenceNumber || '');
        setFullName(fields.fullName || data.registeredAccountName || '');
        setDob(fields.dob || '');
        if (fields.gender === 'FEMALE') {
          setGender('FEMALE');
        } else {
          setGender('MALE');
        }
        setAddress(fields.address || '');
        setNicNumber(fields.nicNumber || '');
        setLicenceCategory(fields.licenceCategory || '');
        setIssueDate(fields.issueDate || '');
        setExpiryDate(fields.expiryDate || '');

        setErrors({});
        setFlowStep('REVIEW');
      }
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setFlowStep('CAPTURE');
      Alert.alert(
        'Document Extraction Notice',
        err.message || 'Could not extract text from document. Please ensure good lighting and no glare, then try again.'
      );
    }
  };

  // Stage D: Client-side Validation of Reviewed Fields
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = 'Full Name is required (minimum 3 characters)';
    }

    if (selectedDocType === 'NIC') {
      const cleanNIC = docNumber.trim().toUpperCase().replace(/[\s-]/g, '');
      const isOldNIC = /^[0-9]{9}[VX]$/.test(cleanNIC);
      const isNewNIC = /^[0-9]{12}$/.test(cleanNIC);
      if (!isOldNIC && !isNewNIC) {
        newErrors.docNumber = 'Invalid Sri Lankan NIC (must be 9 digits + V/X or 12 digits)';
      }
    } else {
      if (!docNumber.trim()) {
        newErrors.docNumber = 'Licence number is required';
      }
      if (nicNumber.trim()) {
        const cleanNIC = nicNumber.trim().toUpperCase().replace(/[\s-]/g, '');
        const isOldNIC = /^[0-9]{9}[VX]$/.test(cleanNIC);
        const isNewNIC = /^[0-9]{12}$/.test(cleanNIC);
        if (!isOldNIC && !isNewNIC) {
          newErrors.nicNumber = 'Invalid NIC format (9 digits + V/X or 12 digits)';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Stage E: Confirmation submission to backend
  const handleConfirmAndContinue = async () => {
    if (!extractedInfo?.documentId) {
      Alert.alert('Session Error', 'No active document extraction session found. Please re-upload your document.');
      setFlowStep('CAPTURE');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Incomplete Information', 'Please correct the highlighted fields before confirming.');
      return;
    }

    try {
      setConfirming(true);

      const payload = {
        documentId: extractedInfo.documentId,
        documentType: selectedDocType,
        confirmedData: {
          documentNumber: docNumber.trim().toUpperCase(),
          fullName: fullName.trim(),
          dob: dob.trim(),
          gender: gender,
          address: address.trim(),
          nicNumber: selectedDocType === 'DRIVING_LICENCE' ? nicNumber.trim().toUpperCase() : docNumber.trim().toUpperCase(),
          licenceCategory: licenceCategory.trim(),
          issueDate: issueDate.trim(),
          expiryDate: expiryDate.trim(),
        }
      };

      const response = await kycService.confirmKYC(payload);
      if (response && response.data) {
        setVerificationResult(response.data);
        setFlowStep('RESULT');
      }
    } catch (err: any) {
      console.error('KYC confirmation error:', err);
      // Preserve user's edited state on network or server error
      Alert.alert(
        'Verification Notice',
        err.message || 'Failed to complete backend verification. Your edited details have been preserved. Please try again.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const currentImage = activeSide === 'front' ? frontImage : backImage;
  const hasAnyImage = !!(frontImage || backImage);

  // Result variables
  const resultStatus = verificationResult?.verificationStatus || 'NOT_SUBMITTED';
  const isVerified = resultStatus === 'VERIFIED';
  const isPending = resultStatus === 'PENDING';
  const isRejected = resultStatus === 'REJECTED';

  // Helper badge for field extraction source
  const renderSourceBadge = (fieldName: string) => {
    const source = extractedInfo?.fieldSources?.[fieldName];
    if (!source) return null;
    let label = 'Extracted';
    if (source === 'front') label = 'From Front';
    if (source === 'back') label = 'From Back';
    if (source === 'derived') label = 'Derived from NIC';

    return (
      <View style={styles.sourcePill}>
        <Text style={styles.sourcePillText}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

          {/* Progress Tracker */}
          <View style={styles.trackerContainer}>
            <View style={styles.stepLabelsRow}>
              <Text style={styles.stepNumberText}>
                {flowStep === 'CAPTURE'
                  ? 'STEP 1 OF 3: CAPTURE DOCUMENT'
                  : flowStep === 'EXTRACTING'
                  ? 'STEP 1 OF 3: OCR EXTRACTION'
                  : flowStep === 'REVIEW'
                  ? 'STEP 2 OF 3: REVIEW & EDIT DATA'
                  : 'STEP 3 OF 3: VERIFICATION RESULT'}
              </Text>
              <Text style={styles.stepPercentText}>
                {flowStep === 'CAPTURE' ? '33%' : flowStep === 'REVIEW' ? '66%' : '100%'}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      flowStep === 'CAPTURE'
                        ? '33%'
                        : flowStep === 'EXTRACTING'
                        ? '50%'
                        : flowStep === 'REVIEW'
                        ? '66%'
                        : '100%',
                    backgroundColor: isRejected ? colors.red : colors.accent,
                  },
                ]}
              />
            </View>
          </View>

          {/* ------------------------------------------------------------- */}
          {/* STAGE A: DOCUMENT CAPTURE VIEW                                 */}
          {/* ------------------------------------------------------------- */}
          {flowStep === 'CAPTURE' && (
            <>
              {/* Document Type Selector */}
              <View style={styles.docTypeRow}>
                <TouchableOpacity
                  style={[styles.docTypeBtn, selectedDocType === 'NIC' && styles.docTypeBtnActive]}
                  onPress={() => {
                    setSelectedDocType('NIC');
                    setActiveSide('front');
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="badge"
                    size={20}
                    color={selectedDocType === 'NIC' ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.docTypeBtnText, selectedDocType === 'NIC' && styles.docTypeBtnTextActive]}>
                    Sri Lankan NIC
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.docTypeBtn, selectedDocType === 'DRIVING_LICENCE' && styles.docTypeBtnActive]}
                  onPress={() => {
                    setSelectedDocType('DRIVING_LICENCE');
                    setActiveSide('front');
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="directions-car"
                    size={20}
                    color={selectedDocType === 'DRIVING_LICENCE' ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.docTypeBtnText, selectedDocType === 'DRIVING_LICENCE' && styles.docTypeBtnTextActive]}>
                    Driving Licence
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Informative Explanation Banner for NICs */}
              {selectedDocType === 'NIC' && (
                <View style={styles.infoBanner}>
                  <MaterialIcons name="info-outline" size={20} color={colors.accent} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.infoBannerTitle}>Sri Lankan NIC Requirements</Text>
                    <Text style={styles.infoBannerText}>
                      • <Text style={{ fontWeight: '700', color: '#FFF' }}>Old 9-Digit NICs:</Text> NIC number is on the <Text style={{ fontWeight: '700', color: '#FFF' }}>Front</Text>, Full Name is on the <Text style={{ fontWeight: '700', color: '#FFF' }}>Back</Text>. Upload both sides.{'\n'}
                      • <Text style={{ fontWeight: '700', color: '#FFF' }}>New 12-Digit Smart NICs:</Text> Front side contains both NIC number and Name.
                    </Text>
                  </View>
                </View>
              )}

              {/* Front / Back Side Selector Tabs (for NICs) */}
              {selectedDocType === 'NIC' && (
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
                        <Text style={styles.requiredPillText}>Required</Text>
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
              <View style={styles.viewfinderContainer}>
                {currentImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: currentImage }} style={styles.previewImage} resizeMode="cover" />
                    <View style={styles.previewTagPill}>
                      <Text style={styles.previewTagText}>
                        {selectedDocType === 'NIC'
                          ? activeSide === 'front'
                            ? 'NIC FRONT SIDE'
                            : 'NIC BACK SIDE'
                          : 'DRIVING LICENCE'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retakePill}
                      onPress={clearActiveImage}
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
                        name={selectedDocType === 'NIC' ? (activeSide === 'front' ? 'id-card' : 'file-signature') : 'id-card-alt'}
                        size={38}
                        color={colors.accent}
                        style={{ marginBottom: 10 }}
                      />
                      <Text style={styles.frameTitle}>
                        {selectedDocType === 'NIC'
                          ? activeSide === 'front'
                            ? 'POSITION FRONT OF SRI LANKAN NIC'
                            : 'POSITION BACK OF SRI LANKAN NIC'
                          : 'POSITION SRI LANKAN DRIVING LICENCE'}
                      </Text>
                      <Text style={styles.frameText}>
                        Ensure all 4 corners are inside frame, text is sharp, and there is no glare.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Camera & Gallery Action Buttons */}
              {!currentImage && (
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

              {/* Dual Slot Quick Overview Cards (for NIC) */}
              {selectedDocType === 'NIC' && (
                <View style={styles.slotsRow}>
                  <TouchableOpacity
                    style={[
                      styles.slotCard,
                      activeSide === 'front' && styles.slotCardActive,
                      frontImage ? styles.slotCardCaptured : null,
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
                        <MaterialIcons name="camera-alt" size={18} color={colors.textSecondary} />
                        <Text style={styles.slotEmptyText}>Front Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.slotCard,
                      activeSide === 'back' && styles.slotCardActive,
                      backImage ? styles.slotCardCaptured : null,
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
                        <MaterialIcons name="flip" size={18} color={colors.textSecondary} />
                        <Text style={styles.slotEmptyText}>Back Side</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Stage A Button: Trigger OCR Extraction */}
              {hasAnyImage && (
                <PrimaryButton
                  title="Extract Information →"
                  onPress={handleExtractOCR}
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE B: OCR EXTRACTION LOADING STATE                          */}
          {/* ------------------------------------------------------------- */}
          {flowStep === 'EXTRACTING' && (
            <View style={styles.extractingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.extractingTitle}>Extracting information from your document...</Text>
              <Text style={styles.extractingSubtitle}>
                Running Tesseract OCR text recognition and document analysis. Please wait a moment.
              </Text>
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE C & D: EXTRACTED INFORMATION REVIEW SCREEN               */}
          {/* ------------------------------------------------------------- */}
          {flowStep === 'REVIEW' && (
            <>
              {/* Success Extraction Banner */}
              <View style={styles.successBanner}>
                <MaterialIcons name="check-circle" size={22} color={colors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.successBannerTitle}>OCR Extraction Complete</Text>
                  <Text style={styles.successBannerText}>
                    Please review and correct the extracted information below before pressing Confirm & Continue.
                  </Text>
                </View>
              </View>

              {/* Document Summary Card */}
              <Card style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View>
                    <Text style={styles.summarySub}>DOCUMENT TYPE</Text>
                    <Text style={styles.summaryTitle}>
                      {selectedDocType === 'NIC' ? 'Sri Lankan National ID (NIC)' : 'Sri Lankan Driving Licence'}
                    </Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <MaterialIcons name="speed" size={14} color={colors.accent} />
                    <Text style={styles.confidenceBadgeText}>
                      {extractedInfo?.ocrConfidence || '85%'} OCR Quality
                    </Text>
                  </View>
                </View>

                {/* Thumbnails Row */}
                <View style={styles.thumbPreviewRow}>
                  {frontImage && (
                    <View style={styles.thumbWrapper}>
                      <Image source={{ uri: frontImage }} style={styles.reviewThumb} />
                      <Text style={styles.thumbLabel}>Front</Text>
                    </View>
                  )}
                  {backImage && (
                    <View style={styles.thumbWrapper}>
                      <Image source={{ uri: backImage }} style={styles.reviewThumb} />
                      <Text style={styles.thumbLabel}>Back</Text>
                    </View>
                  )}
                </View>
              </Card>

              {/* Editable Fields Section Header */}
              <View style={styles.sectionHeaderRow}>
                <MaterialIcons name="edit" size={18} color={colors.accent} />
                <Text style={styles.sectionHeaderText}>Review & Correct Extracted Details</Text>
              </View>
              <Text style={styles.sectionSubtext}>
                Tap any field to correct OCR misrecognitions. Required fields are marked with (*).
              </Text>

              {/* Form Fields: Controlled Inputs */}
              <View style={styles.formContainer}>
                {/* 1. Document / NIC Number */}
                <View style={styles.inputGroup}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>
                      {selectedDocType === 'NIC' ? 'NIC NUMBER *' : 'LICENCE NUMBER *'}
                    </Text>
                    {renderSourceBadge('documentNumber')}
                  </View>
                  <TextInput
                    style={[styles.inputField, errors.docNumber ? styles.inputError : null]}
                    value={docNumber}
                    onChangeText={(text) => {
                      setDocNumber(text);
                      if (errors.docNumber) {
                        setErrors((prev) => ({ ...prev, docNumber: '' }));
                      }
                    }}
                    placeholder={selectedDocType === 'NIC' ? 'e.g. 199204502391 or 921450239V' : 'e.g. B1234567'}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                  />
                  {errors.docNumber ? (
                    <Text style={styles.errorText}>{errors.docNumber}</Text>
                  ) : null}
                </View>

                {/* 2. Full Name */}
                <View style={styles.inputGroup}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>FULL NAME *</Text>
                    {renderSourceBadge('fullName')}
                  </View>
                  <TextInput
                    style={[styles.inputField, errors.fullName ? styles.inputError : null]}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      if (errors.fullName) {
                        setErrors((prev) => ({ ...prev, fullName: '' }));
                      }
                    }}
                    placeholder="Cardholder Full Name"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                  />
                  {errors.fullName ? (
                    <Text style={styles.errorText}>{errors.fullName}</Text>
                  ) : null}
                </View>

                {/* 3. Date of Birth */}
                <View style={styles.inputGroup}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                    {renderSourceBadge('dob')}
                  </View>
                  <TextInput
                    style={styles.inputField}
                    value={dob}
                    onChangeText={setDob}
                    placeholder="YYYY-MM-DD (e.g. 1992-05-24)"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                {/* 4. Gender (for NIC) */}
                {selectedDocType === 'NIC' && (
                  <View style={styles.inputGroup}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={styles.fieldLabel}>GENDER</Text>
                      {renderSourceBadge('gender')}
                    </View>
                    <View style={styles.genderRow}>
                      <TouchableOpacity
                        style={[styles.genderBtn, gender === 'MALE' && styles.genderBtnActive]}
                        onPress={() => setGender('MALE')}
                      >
                        <MaterialIcons
                          name="male"
                          size={18}
                          color={gender === 'MALE' ? colors.accent : colors.textSecondary}
                        />
                        <Text style={[styles.genderBtnText, gender === 'MALE' && styles.genderBtnTextActive]}>
                          MALE
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.genderBtn, gender === 'FEMALE' && styles.genderBtnActive]}
                        onPress={() => setGender('FEMALE')}
                      >
                        <MaterialIcons
                          name="female"
                          size={18}
                          color={gender === 'FEMALE' ? colors.accent : colors.textSecondary}
                        />
                        <Text style={[styles.genderBtnText, gender === 'FEMALE' && styles.genderBtnTextActive]}>
                          FEMALE
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Driving Licence Specific Fields */}
                {selectedDocType === 'DRIVING_LICENCE' && (
                  <>
                    <View style={styles.inputGroup}>
                      <View style={styles.fieldHeaderRow}>
                        <Text style={styles.fieldLabel}>NIC NUMBER (ON LICENCE)</Text>
                        {renderSourceBadge('nicNumber')}
                      </View>
                      <TextInput
                        style={[styles.inputField, errors.nicNumber ? styles.inputError : null]}
                        value={nicNumber}
                        onChangeText={(text) => {
                          setNicNumber(text);
                          if (errors.nicNumber) setErrors((prev) => ({ ...prev, nicNumber: '' }));
                        }}
                        placeholder="e.g. 921450239V"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="characters"
                      />
                      {errors.nicNumber ? <Text style={styles.errorText}>{errors.nicNumber}</Text> : null}
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={styles.fieldHeaderRow}>
                        <Text style={styles.fieldLabel}>VEHICLE CATEGORIES</Text>
                        {renderSourceBadge('licenceCategory')}
                      </View>
                      <TextInput
                        style={styles.inputField}
                        value={licenceCategory}
                        onChangeText={setLicenceCategory}
                        placeholder="e.g. A, B, B1"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.rowTwoCols}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.fieldLabel}>ISSUE DATE</Text>
                        <TextInput
                          style={styles.inputField}
                          value={issueDate}
                          onChangeText={setIssueDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                        <Text style={styles.fieldLabel}>EXPIRY DATE</Text>
                        <TextInput
                          style={styles.inputField}
                          value={expiryDate}
                          onChangeText={setExpiryDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Address (Optional) */}
                <View style={styles.inputGroup}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>ADDRESS (OPTIONAL)</Text>
                    {renderSourceBadge('address')}
                  </View>
                  <TextInput
                    style={[styles.inputField, { height: 64, textAlignVertical: 'top' }]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Residential address as stated on document"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                </View>

                {/* Collapsible View for Raw OCR Text */}
                <TouchableOpacity
                  style={styles.rawOcrToggle}
                  onPress={() => setShowRawOcr(!showRawOcr)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={showRawOcr ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.rawOcrToggleText}>
                    {showRawOcr ? 'Hide Raw OCR Text' : 'View Raw Extracted OCR Text'}
                  </Text>
                </TouchableOpacity>

                {showRawOcr && (
                  <View style={styles.rawOcrBox}>
                    <Text style={styles.rawOcrContent}>
                      {extractedInfo?.rawOcrText || 'No raw text available.'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Stage E: Actions Area */}
              <View style={styles.buttonActionArea}>
                <PrimaryButton
                  title="CONFIRM & CONTINUE →"
                  onPress={handleConfirmAndContinue}
                  loading={confirming}
                  disabled={confirming}
                />

                <TouchableOpacity
                  style={styles.secondaryRetakeBtn}
                  onPress={() => setFlowStep('CAPTURE')}
                  disabled={confirming}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={18} color={colors.textSecondary} />
                  <Text style={styles.secondaryRetakeText}>Retake / Upload Again</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE F: BACKEND VERIFICATION RESULT                           */}
          {/* ------------------------------------------------------------- */}
          {flowStep === 'RESULT' && verificationResult && (
            <Card style={styles.resultCard}>
              <View style={styles.resultIconWrapper}>
                <MaterialIcons
                  name={isVerified ? 'verified-user' : isPending ? 'hourglass-top' : 'error-outline'}
                  size={54}
                  color={isVerified ? colors.accent : isPending ? colors.yellow : colors.red}
                />
              </View>

              <Text
                style={[
                  styles.resultTitle,
                  { color: isVerified ? colors.accent : isPending ? colors.yellow : colors.red },
                ]}
              >
                {isVerified
                  ? 'Identity Verification Complete'
                  : isPending
                  ? 'Application Under Review'
                  : 'Verification Unsuccessful'}
              </Text>

              <Text style={styles.resultSubtitle}>
                {isVerified
                  ? 'Your Sri Lankan identity document has been verified. You now have full access to trading.'
                  : isPending
                  ? 'Your verified document details have been submitted to compliance. Administrative verification typically completes within a few minutes.'
                  : (verificationResult.rejectionReason || 'Identity verification could not be approved with the provided document.')}
              </Text>

              {/* Verified Details Summary */}
              <View style={styles.verifiedDetailsBox}>
                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedLabel}>DOCUMENT TYPE:</Text>
                  <Text style={styles.verifiedValue}>
                    {verificationResult.confirmedData?.documentType || verificationResult.extractedData?.documentType || 'NIC'}
                  </Text>
                </View>

                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedLabel}>DOCUMENT NUMBER:</Text>
                  <Text style={[styles.verifiedValue, { color: colors.accent }]}>
                    {verificationResult.confirmedData?.documentNumber || verificationResult.extractedData?.nicNumber || '---'}
                  </Text>
                </View>

                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedLabel}>CARDHOLDER NAME:</Text>
                  <Text style={styles.verifiedValue}>
                    {verificationResult.confirmedData?.fullName || verificationResult.extractedData?.name || '---'}
                  </Text>
                </View>

                {verificationResult.confirmedData?.dob && (
                  <View style={styles.verifiedRow}>
                    <Text style={styles.verifiedLabel}>DATE OF BIRTH:</Text>
                    <Text style={styles.verifiedValue}>{verificationResult.confirmedData.dob}</Text>
                  </View>
                )}

                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedLabel}>STATUS:</Text>
                  <Text
                    style={[
                      styles.verifiedValue,
                      { color: isVerified ? colors.accent : isPending ? colors.yellow : colors.red },
                    ]}
                  >
                    {resultStatus}
                  </Text>
                </View>
              </View>

              {/* Action Button */}
              {isVerified ? (
                <PrimaryButton
                  title="Continue to Trading Dashboard →"
                  onPress={() => navigation.navigate('MainApp')}
                  style={{ marginTop: 16 }}
                />
              ) : isPending ? (
                <PrimaryButton
                  title="Return to Dashboard →"
                  onPress={() => navigation.navigate('MainApp')}
                  style={{ marginTop: 16 }}
                />
              ) : (
                <TouchableOpacity
                  style={styles.retryActionBtn}
                  onPress={() => {
                    setFrontImage(null);
                    setBackImage(null);
                    setActiveSide('front');
                    setVerificationResult(null);
                    setFlowStep('CAPTURE');
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={18} color="#000" />
                  <Text style={styles.retryActionBtnText}>Try Again / Resubmit Document</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepNumberText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  stepPercentText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  docTypeRow: {
    flexDirection: 'row',
    marginBottom: spacing.m,
  },
  docTypeBtn: {
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
  docTypeBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  docTypeBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  docTypeBtnTextActive: {
    color: colors.accent,
    fontWeight: '700',
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
    marginBottom: 4,
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
  frameTitle: {
    ...typography.label,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  frameText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '85%',
    fontSize: 11,
    lineHeight: 16,
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
  extractingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  extractingTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 16,
    textAlign: 'center',
  },
  extractingSubtitle: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0A2618',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    marginBottom: spacing.m,
  },
  successBannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 2,
  },
  successBannerText: {
    ...typography.bodySmall,
    color: '#C2EED7',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryCard: {
    marginBottom: spacing.m,
    padding: spacing.m,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summarySub: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
  },
  summaryTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    fontSize: 14,
    marginTop: 2,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 4,
  },
  thumbPreviewRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  thumbWrapper: {
    alignItems: 'center',
    marginRight: 12,
  },
  reviewThumb: {
    width: 72,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeaderText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    fontSize: 15,
    marginLeft: 8,
  },
  sectionSubtext: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  formContainer: {
    marginBottom: spacing.m,
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  sourcePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourcePillText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  inputField: {
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusSmall,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.red,
  },
  errorText: {
    color: colors.red,
    fontSize: 11,
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row',
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgInput,
    paddingVertical: 12,
    borderRadius: layout.borderRadiusSmall,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  genderBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '20',
  },
  genderBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 6,
  },
  genderBtnTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  rawOcrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  rawOcrToggleText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 6,
  },
  rawOcrBox: {
    backgroundColor: '#0E1410',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rawOcrContent: {
    ...typography.label,
    fontSize: 10,
    color: '#8A9E93',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonActionArea: {
    marginTop: 10,
  },
  secondaryRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  secondaryRetakeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 6,
  },
  resultCard: {
    padding: spacing.l,
    alignItems: 'center',
    marginTop: 16,
  },
  resultIconWrapper: {
    marginBottom: 12,
  },
  resultTitle: {
    ...typography.h3,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  resultSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  verifiedDetailsBox: {
    width: '100%',
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  verifiedValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
    fontSize: 12,
  },
  retryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    width: '100%',
    marginTop: 16,
  },
  retryActionBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#000',
    marginLeft: 6,
  },
});
