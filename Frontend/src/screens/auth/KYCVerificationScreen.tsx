import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { kycService } from '../../services/apiService';

export const KYCVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const [nicNumber, setNicNumber] = useState('199204502391');
  const [fullName, setFullName] = useState('Janith Madushanka De Silva');
  const [address, setAddress] = useState('No 45/2, Galle Road, Colombo 03');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('NOT_SUBMITTED');
  const [extractedData, setExtractedData] = useState<any>(null);

  const checkStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await kycService.getKycStatus();
      if (res?.success && res?.data) {
        setKycStatus(res.data.status);
        if (res.data.nicNumber) setNicNumber(res.data.nicNumber);
        if (res.data.fullName) setFullName(res.data.fullName);
        if (res.data.extractedData) setExtractedData(res.data.extractedData);
      }
    } catch (error) {
      console.error('Failed to get KYC status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleVerify = async () => {
    if (!nicNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter a Sri Lankan National Identity Card (NIC) number.');
      return;
    }

    try {
      setLoading(true);
      const res = await kycService.verifyNic({
        nicNumber: nicNumber.trim(),
        fullName: fullName.trim(),
        address: address.trim(),
      });

      if (res?.success) {
        setExtractedData(res.data.extractedDetails);
        setKycStatus(res.data.status);
        Alert.alert(
          'Verification Successful',
          `Your NIC was verified successfully as a valid ${res.data.extractedDetails.format} format Sri Lankan National Identity Card. Your account status is now VERIFIED.`,
          [{ text: 'Continue to Platform', onPress: () => navigation.navigate('MainApp') }]
        );
      } else {
        Alert.alert('Verification Failed', res?.message || 'Invalid NIC format.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Verification failed. Please check NIC format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KYC & Identity Verification</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Tracker */}
        <View style={styles.trackerContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.stepText}>Sri Lankan Regulatory Compliance</Text>
            <View style={[styles.statusBadge, kycStatus === 'VERIFIED' ? styles.statusBadgeVerified : styles.statusBadgePending]}>
              <Text style={styles.statusBadgeText}>{kycStatus}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: kycStatus === 'VERIFIED' ? '100%' : '66%' }]} />
          </View>
          <Text style={styles.stepLabel}>SEC / Central Bank of Sri Lanka Verification</Text>
        </View>

        {/* Viewfinder Mockup */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinderBg}>
            <View style={styles.frameOverlay}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <FontAwesome5 name="id-card" size={36} color={colors.accent} style={{ marginBottom: 12 }} />
              <Text style={styles.frameText}>Sri Lankan NIC (Old 9V/9X or New 12-Digit)</Text>
            </View>
          </View>
        </View>

        {/* Inputs */}
        <Card style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Identity Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NIC NUMBER (9-Digit + V or 12-Digit)</Text>
            <TextInput
              style={styles.textInput}
              value={nicNumber}
              onChangeText={setNicNumber}
              placeholder="e.g. 199204502391 or 920452391V"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL LEGAL NAME</Text>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="As on National Identity Card"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PERMANENT RESIDENTIAL ADDRESS</Text>
            <TextInput
              style={styles.textInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Residential address in Sri Lanka"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </Card>

        {/* Live Extraction Data Card */}
        {extractedData && (
          <Card style={styles.extractionCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>OCR Extracted Metadata</Text>
              <View style={styles.statusBadgeVerified}>
                <Text style={styles.statusBadgeText}>PARSED VALID</Text>
              </View>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>FORMAT:</Text>
              <Text style={styles.dataValue}>{extractedData.format}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>BIRTH YEAR:</Text>
              <Text style={styles.dataValue}>{extractedData.birthYear}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>DAY OF YEAR:</Text>
              <Text style={styles.dataValue}>{extractedData.dayOfYear}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>GENDER:</Text>
              <Text style={styles.dataValue}>{extractedData.gender}</Text>
            </View>
          </Card>
        )}

        {/* Action Button */}
        <View style={{ marginTop: 24, marginBottom: 40 }}>
          <PrimaryButton
            title={loading ? "Verifying with OCR Engine..." : (kycStatus === 'VERIFIED' ? "KYC Already Verified — Proceed" : "Submit NIC for Verification →")}
            onPress={kycStatus === 'VERIFIED' ? () => navigation.navigate('MainApp') : handleVerify}
            disabled={loading}
          />
        </View>

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
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  trackerContainer: {
    marginBottom: 20,
  },
  stepText: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgePending: {
    backgroundColor: colors.yellow + '33',
  },
  statusBadgeVerified: {
    backgroundColor: colors.accentMuted,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  stepLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  viewfinderContainer: {
    height: 180,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  viewfinderBg: {
    flex: 1,
    backgroundColor: '#151A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameOverlay: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  frameText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    padding: 20,
    marginBottom: 16,
  },
  formSectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  extractionCard: {
    padding: 16,
    backgroundColor: colors.bgCard,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dataLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  dataValue: {
    ...typography.bodySmall,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
