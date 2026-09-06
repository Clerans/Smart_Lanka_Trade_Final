import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';

export const KYCVerificationScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identity Verification</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Tracker */}
        <View style={styles.trackerContainer}>
          <Text style={styles.stepText}>Step 1 of 3</Text>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.stepLabel}>Document Capture</Text>
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinderContainer}>
          {/* Faked blur background for aesthetic */}
          <View style={styles.viewfinderBg}>
            <View style={styles.frameOverlay}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <Text style={styles.frameText}>Position your NIC or Passport within the frame</Text>
            </View>
          </View>
        </View>

        {/* Live Extraction Data Card */}
        <Card style={styles.extractionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Live Extraction</Text>
            <View style={styles.statusBadge}>
              <MaterialIcons name="pending-actions" size={12} color="#FFF" />
              <Text style={styles.statusText}>Pending</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>OCR Preview</Text>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>FULL NAME:</Text>
            <Text style={styles.dataValue}>JANITH MADUSHANKA DE SILVA</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>ID NUMBER:</Text>
            <Text style={styles.dataValue}>199204502391</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>DATE OF BIRTH:</Text>
            <Text style={styles.dataValue}>14/02/1992</Text>
          </View>
        </Card>

        {/* Upload Button Alternative */}
        <TouchableOpacity style={styles.uploadBtn}>
          <MaterialIcons name="upload-file" size={20} color={colors.textPrimary} />
          <Text style={styles.uploadBtnText}>Upload NIC/Passport instead</Text>
        </TouchableOpacity>

        {/* Camera Controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="photo-library" size={28} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterBtn}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="flash-on" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <PrimaryButton
          title="Continue to Verification →"
          onPress={() => navigation.navigate('MainApp')}
        />

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
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  trackerContainer: {
    marginBottom: 24,
  },
  stepText: {
    ...typography.label,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '33%',
    height: '100%',
    backgroundColor: colors.accent,
  },
  stepLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  viewfinderContainer: {
    height: 220,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
  },
  viewfinderBg: {
    flex: 1,
    backgroundColor: '#1E2320', // subtle green tint for fake camera
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameOverlay: {
    width: '85%',
    height: '75%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  frameText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    textAlign: 'center',
    maxWidth: '70%',
  },
  extractionCard: {
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.yellow + '33', // amber transparent
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    marginBottom: 16,
  },
  dataRow: {
    marginBottom: 12,
  },
  dataLabel: {
    ...typography.bodySmall,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dataValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusPill,
    marginBottom: 32,
  },
  uploadBtnText: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: 8,
    fontWeight: '600',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  iconBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.textPrimary,
  },
});
