import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';

export const SecuritySettingsScreen = () => {
  const navigation = useNavigation<any>();

  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.sectionHeading}>AUTHENTICATION</Text>

        {/* Toggles Container */}
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBg}>
                <MaterialIcons name="fingerprint" size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingText}>Biometric Login</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBg}>
                <MaterialIcons name="phonelink-lock" size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingText}>Two-Factor Auth (2FA)</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={twoFactorEnabled}
              onValueChange={setTwoFactorEnabled}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, !faceIdEnabled && styles.iconBgDisabled]}>
                <MaterialIcons
                  name="face"
                  size={20}
                  color={faceIdEnabled ? colors.accent : colors.textSecondary}
                />
              </View>
              <Text style={styles.settingText}>Face ID Verification</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={faceIdEnabled}
              onValueChange={setFaceIdEnabled}
            />
          </View>
        </View>

        <Text style={styles.sectionHeading}>CREDENTIALS & DEVICES</Text>

        {/* Action Rows */}
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.actionRow}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="dialpad" size={20} color={colors.textPrimary} />
              </View>
              <Text style={styles.actionText}>Change PIN</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="lock-outline" size={20} color={colors.textPrimary} />
              </View>
              <Text style={styles.actionText}>Change Password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="devices" size={20} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.actionText}>Device Management</Text>
                <Text style={styles.actionSubtext}>2 Active Devices</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            Last login: Today, 10:45 AM from Colombo, LK
          </Text>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  sectionHeading: {
    ...typography.label,
    color: colors.textSecondary,
    marginLeft: 24,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  settingsGroup: {
    marginHorizontal: 24,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    marginBottom: 32,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconBgDisabled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    ...typography.body,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...typography.body,
    fontWeight: '600',
  },
  actionSubtext: {
    ...typography.label,
    color: colors.accent,
    marginTop: 4,
    fontSize: 10,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 8,
  },
});
