import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, layout } from '../../theme';
import { authService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

export const SecuritySettingsScreen = () => {
  const navigation = useNavigation<any>();

  // Security Preferences State
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);

  // Modal States
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [devicesModalVisible, setDevicesModalVisible] = useState(false);

  // PIN Form
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Devices State (Real runtime active device)
  const [activeDevices, setActiveDevices] = useState<{ id: string; name: string; location: string; ip: string; activeNow: boolean; lastActive?: string; icon: string }[]>([
    { id: '1', name: 'Mobile App (This Device)', location: 'Current Session', ip: 'Encrypted Hardware Session', activeNow: true, lastActive: 'Active Now', icon: 'smartphone' }
  ]);


  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const bio = await AsyncStorage.getItem('@pref_biometric');
        if (bio !== null) setBiometricEnabled(bio === 'true');

        const tfa = await AsyncStorage.getItem('@pref_2fa');
        if (tfa !== null) setTwoFactorEnabled(tfa === 'true');

        const face = await AsyncStorage.getItem('@pref_face_id');
        if (face !== null) setFaceIdEnabled(face === 'true');

        const storedPin = await storageService.getPin();
        if (storedPin) setSavedPin(storedPin);
      } catch {
        // ignore load errors
      }
    };
    loadPreferences();
  }, []);

  // Handlers for toggles
  const handleBiometricToggle = async (val: boolean) => {
    setBiometricEnabled(val);
    await AsyncStorage.setItem('@pref_biometric', String(val));
    if (val) {
      Alert.alert('Biometric Login Enabled', 'You can now use fingerprint and biometric authentication for quick login.');
    } else {
      Alert.alert('Biometric Login Disabled', 'Password or PIN will be required upon app launch.');
    }
  };

  const handle2FAToggle = async (val: boolean) => {
    setTwoFactorEnabled(val);
    await AsyncStorage.setItem('@pref_2fa', String(val));
    if (val) {
      Alert.alert('2-Factor Authentication Active', 'OTP verification will be required for trades and withdrawals over LKR 100,000.');
    } else {
      Alert.alert('2FA Disabled', 'Two-factor protection has been disabled for standard transactions.');
    }
  };

  const handleFaceIdToggle = async (val: boolean) => {
    setFaceIdEnabled(val);
    await AsyncStorage.setItem('@pref_face_id', String(val));
    if (val) {
      Alert.alert('Face ID Enabled', 'Facial recognition authentication is enabled for high-security transactions.');
    }
  };

  // Change PIN Submit (Hardware SecureStore Encrypted)
  const handleSavePin = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit numeric security PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'The confirmation PIN does not match. Please re-enter.');
      return;
    }
    try {
      await storageService.setPin(pin);
      setSavedPin(pin);
      setPinModalVisible(false);
      setPin('');
      setConfirmPin('');
      Alert.alert('Success', 'Your 4-digit security PIN has been securely updated in hardware-backed storage.');
    } catch {
      Alert.alert('Error', 'Failed to save security PIN.');
    }
  };

  // Change Password Submit
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await authService.changePassword(currentPassword, newPassword);
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Your account password has been changed successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Terminate other sessions
  const handleTerminateOtherSessions = () => {
    Alert.alert(
      'Terminate Other Sessions',
      'Are you sure you want to sign out all other connected devices?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Others',
          style: 'destructive',
          onPress: () => {
            setActiveDevices(activeDevices.filter(d => d.activeNow));
            Alert.alert('Sessions Terminated', 'All other active sessions have been signed out.');
          }
        }
      ]
    );
  };

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
              <View>
                <Text style={styles.settingText}>Biometric Login</Text>
                <Text style={styles.subSettingText}>Use fingerprint for quick access</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBg}>
                <MaterialIcons name="phonelink-lock" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.settingText}>Two-Factor Auth (2FA)</Text>
                <Text style={styles.subSettingText}>Email / SMS OTP verification</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={twoFactorEnabled}
              onValueChange={handle2FAToggle}
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
              <View>
                <Text style={styles.settingText}>Face ID Verification</Text>
                <Text style={styles.subSettingText}>Facial unlock for high security</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={faceIdEnabled}
              onValueChange={handleFaceIdToggle}
            />
          </View>
        </View>

        <Text style={styles.sectionHeading}>CREDENTIALS & DEVICES</Text>

        {/* Action Rows */}
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.actionRow} onPress={() => setPinModalVisible(true)}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="dialpad" size={20} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.actionText}>Change PIN</Text>
                <Text style={styles.actionSubtext}>{savedPin ? '4-Digit PIN Configured' : 'Set Quick Access PIN'}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={() => setPasswordModalVisible(true)}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="lock-outline" size={20} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.actionText}>Change Password</Text>
                <Text style={styles.actionSubtext}>Update your account login password</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={() => setDevicesModalVisible(true)}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="devices" size={20} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.actionText}>Device Management</Text>
                <Text style={[styles.actionSubtext, { color: colors.accent }]}>
                  {activeDevices.length} Active {activeDevices.length === 1 ? 'Device' : 'Devices'}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            Last login: Today from Colombo, LK (Active Session)
          </Text>
        </View>

      </ScrollView>

      {/* 1. CHANGE PIN MODAL */}
      <Modal visible={pinModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Quick Access PIN</Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Enter a 4-digit security PIN to quickly unlock and authorize demo transactions.
            </Text>

            <Text style={styles.inputLabel}>New 4-Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />

            <Text style={styles.inputLabel}>Confirm 4-Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSavePin}>
              <Text style={styles.modalButtonText}>Save Security PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. CHANGE PASSWORD MODAL */}
      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Account Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Ensure your new password has at least 8 characters with upper, lower, numbers and symbols.
            </Text>

            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.modalInputInline}
                placeholder="Enter current password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showCurrentPw}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.eyeBtn}>
                <MaterialIcons name={showCurrentPw ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.modalInputInline}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showNewPw}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeBtn}>
                <MaterialIcons name={showNewPw ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showNewPw}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />

            <TouchableOpacity
              style={[styles.modalButton, isChangingPassword && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.modalButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. DEVICE MANAGEMENT MODAL */}
      <Modal visible={devicesModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connected Devices</Text>
              <TouchableOpacity onPress={() => setDevicesModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              These devices are currently authenticated to your SmartLanka Trade account.
            </Text>

            {activeDevices.map(device => (
              <View key={device.id} style={styles.deviceCard}>
                <View style={styles.deviceIconBg}>
                  <MaterialIcons name={device.icon as any} size={22} color={device.activeNow ? colors.accent : colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    {device.activeNow && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE NOW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.deviceSub}>{device.location} • {device.ip}</Text>
                  {!device.activeNow && (
                    <Text style={styles.deviceLastActive}>Last active: {device.lastActive}</Text>
                  )}
                </View>
              </View>
            ))}

            {activeDevices.length > 1 && (
              <TouchableOpacity style={styles.terminateBtn} onPress={handleTerminateOtherSessions}>
                <MaterialIcons name="power-settings-new" size={18} color={colors.red} style={{ marginRight: 8 }} />
                <Text style={styles.terminateBtnText}>Sign Out Other Devices</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

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
    color: '#FFF',
    fontSize: 18,
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
    flex: 1,
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
    color: '#FFF',
  },
  subSettingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
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
    flex: 1,
  },
  actionText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  actionSubtext: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 11,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    ...typography.h2,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    fontSize: 12,
  },
  modalInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  modalInputInline: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 14,
  },
  modalButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  deviceName: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  deviceSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  deviceLastActive: {
    ...typography.bodySmall,
    color: colors.yellow,
    fontSize: 10,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
  },
  terminateBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  terminateBtnText: {
    color: colors.red,
    fontWeight: '700',
    fontSize: 14,
  },
});
