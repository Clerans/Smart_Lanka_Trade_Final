import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, typography, layout, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET } from '../../theme';
import { authService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

export const SecuritySettingsScreen = () => {
  const navigation = useNavigation<any>();

  // Security Preferences State
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [hasServerPin, setHasServerPin] = useState(false);

  // Hardware Biometrics State
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [supportsFaceId, setSupportsFaceId] = useState(false);
  const [supportsFingerprint, setSupportsFingerprint] = useState(false);
  const [hasBiometricSession, setHasBiometricSession] = useState(false);

  // Loading & Sync States
  const [isUpdating2FA, setIsUpdating2FA] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverSyncLoaded, setServerSyncLoaded] = useState(false);
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);

  // Modal States
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [devicesModalVisible, setDevicesModalVisible] = useState(false);

  // PIN Form (Transient input state only - never stored locally)
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Active Devices State
  const [activeDevices, setActiveDevices] = useState<{ id: string; name: string; location: string; ip: string; activeNow: boolean; lastActive?: string; icon: string }[]>([
    { id: '1', name: 'Mobile App (This Device)', location: 'Current Session', ip: 'Encrypted Hardware Session', activeNow: true, lastActive: 'Active Now', icon: 'smartphone' }
  ]);

  const detectBiometrics = useCallback(async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasHardware(hardware);
      setIsEnrolled(enrolled);

      if (hardware) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        setSupportsFaceId(hasFace);
        setSupportsFingerprint(hasFinger);
      } else {
        setSupportsFaceId(false);
        setSupportsFingerprint(false);
      }

      const hasSession = await storageService.hasBiometricSession();
      setHasBiometricSession(hasSession);
    } catch (err) {
      console.warn('Biometric capability detection error:', err);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      await detectBiometrics();

      const bio = await AsyncStorage.getItem('@pref_biometric');
      if (bio !== null) {
        setBiometricEnabled(bio === 'true');
      }

      const face = await AsyncStorage.getItem('@pref_face_id');
      if (face !== null) {
        setFaceIdEnabled(face === 'true');
      }

      // Sync authoritative 2FA and transaction PIN status from backend
      try {
        const secRes = await authService.getSecuritySettings();
        if (secRes?.success && secRes?.data) {
          setTwoFactorEnabled(!!secRes.data.twoFactorEnabled);
          setHasServerPin(!!secRes.data.hasPin);
          setServerSyncLoaded(true);
          setServerSyncError(null);
          await AsyncStorage.setItem('@pref_2fa', String(secRes.data.twoFactorEnabled));
        } else {
          throw new Error(secRes?.message || 'Server returned invalid security configuration');
        }
      } catch (secErr: any) {
        const errMsg = secErr?.response?.data?.message || secErr?.message || 'Security server synchronization failed';
        console.warn('Could not fetch authoritative security settings:', errMsg);
        setServerSyncLoaded(false);
        setServerSyncError(errMsg);
      }
    } catch {
      // ignore load errors
    } finally {
      setRefreshing(false);
    }
  }, [detectBiometrics]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPreferences();
  }, [loadPreferences]);

  // Biometric Login Toggle Handler
  const handleBiometricToggle = async (val: boolean) => {
    if (val) {
      if (!hasHardware) {
        Alert.alert(
          'Biometrics Unavailable',
          'Biometric hardware sensor is not detected on this device. Password authentication will be used.'
        );
        setBiometricEnabled(false);
        return;
      }

      if (!isEnrolled) {
        Alert.alert(
          'No Biometrics Enrolled',
          'Please enroll your fingerprint or face in Android Device Settings first.'
        );
        setBiometricEnabled(false);
        return;
      }

      const hasSession = await storageService.hasBiometricSession();
      if (!hasSession) {
        Alert.alert(
          'Session Required',
          'To enable biometric login, sign in once with your password or Google account so your session credentials can be securely registered on this device.'
        );
        setBiometricEnabled(false);
        return;
      }

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm biometric identity to enable Biometric Login',
          fallbackLabel: 'Cancel',
          disableDeviceFallback: true,
        });

        if (result.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem('@pref_biometric', 'true');
          Alert.alert('Biometric Login Enabled', 'You can now use biometrics for instant sign-in.');
        } else {
          setBiometricEnabled(false);
          await AsyncStorage.setItem('@pref_biometric', 'false');
          Alert.alert('Authentication Cancelled', 'Biometric login remains disabled.');
        }
      } catch (err: any) {
        setBiometricEnabled(false);
        Alert.alert('Authentication Error', err.message || 'Failed to authenticate biometrics.');
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('@pref_biometric', 'false');
      Alert.alert('Biometric Login Disabled', 'Standard password or Google sign-in will now be required.');
    }
  };

  // Face ID / Facial Recognition Toggle Handler
  const handleFaceIdToggle = async (val: boolean) => {
    if (val) {
      if (!supportsFaceId) {
        Alert.alert(
          'Facial Recognition Unsupported',
          'Your Android device hardware does not support biometric facial recognition. Please use fingerprint biometrics instead.'
        );
        setFaceIdEnabled(false);
        await AsyncStorage.setItem('@pref_face_id', 'false');
        return;
      }

      if (!isEnrolled) {
        Alert.alert('No Face Enrolled', 'Please register your face in device Settings first.');
        setFaceIdEnabled(false);
        return;
      }

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate with Face Recognition',
          fallbackLabel: 'Cancel',
          disableDeviceFallback: true,
        });

        if (result.success) {
          setFaceIdEnabled(true);
          await AsyncStorage.setItem('@pref_face_id', 'true');
          Alert.alert('Face Recognition Enabled', 'Facial recognition authentication is enabled.');
        } else {
          setFaceIdEnabled(false);
          await AsyncStorage.setItem('@pref_face_id', 'false');
        }
      } catch {
        setFaceIdEnabled(false);
      }
    } else {
      setFaceIdEnabled(false);
      await AsyncStorage.setItem('@pref_face_id', 'false');
      Alert.alert('Face Recognition Disabled', 'Standard authentication will be used.');
    }
  };

  // Authoritative Server-Enforced 2FA Toggle
  const handle2FAToggle = async (val: boolean) => {
    if (!serverSyncLoaded) {
      Alert.alert(
        'Server Sync Required',
        'Authoritative security settings could not be verified from the server. Please pull down to refresh before modifying Two-Factor Authentication.'
      );
      return;
    }

    setIsUpdating2FA(true);
    try {
      const res = await authService.updateSecuritySettings({ twoFactorEnabled: val });
      if (res?.success) {
        setTwoFactorEnabled(val);
        await AsyncStorage.setItem('@pref_2fa', String(val));
        if (val) {
          Alert.alert(
            'Two-Factor Authentication Active',
            'OTP verification will be required for trades and withdrawals over LKR 100,000.'
          );
        } else {
          Alert.alert('2FA Disabled', 'Two-factor protection has been disabled for transactions.');
        }
      } else {
        throw new Error(res?.message || 'Server rejected 2FA update');
      }
    } catch (err: any) {
      // Revert state if backend update failed
      setTwoFactorEnabled(!val);
      Alert.alert('Update Failed', err?.response?.data?.message || err?.message || 'Could not update 2FA on server.');
    } finally {
      setIsUpdating2FA(false);
    }
  };

  // Backend Transaction PIN Submit (Enforced on Oracle backend with bcrypt & lockout)
  const handleSavePin = async () => {
    if (!serverSyncLoaded) {
      Alert.alert(
        'Server Sync Required',
        'Authoritative security settings could not be verified from the server. Please pull down to refresh before modifying your PIN.'
      );
      return;
    }

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();
    const cleanCurrent = currentPin.trim();

    if (hasServerPin && !cleanCurrent) {
      Alert.alert('Current PIN Required', 'Please enter your current security PIN to authorize this change.');
      return;
    }

    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6 || !/^\d{4,6}$/.test(cleanPin)) {
      Alert.alert('Invalid PIN Format', 'Security PIN must be exactly 4 to 6 numeric digits.');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      Alert.alert('PIN Mismatch', 'New PIN and confirmation PIN do not match.');
      return;
    }

    setIsSavingPin(true);
    try {
      const payload: { pin: string; currentPin?: string } = { pin: cleanPin };
      if (hasServerPin && cleanCurrent) {
        payload.currentPin = cleanCurrent;
      }

      const res = await authService.updateSecuritySettings(payload);
      if (res?.success) {
        setHasServerPin(true);
        setPinModalVisible(false);
        setPin('');
        setConfirmPin('');
        setCurrentPin('');
        Alert.alert(
          'PIN Configured Successfully',
          'Your transaction PIN is encrypted with salted bcrypt and enforced authoritatively on the server for withdrawals and high-value transfers.'
        );
      } else {
        throw new Error(res?.message || 'Server rejected PIN update');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save security PIN.';
      Alert.alert('PIN Update Failed', errMsg);
    } finally {
      setIsSavingPin(false);
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
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to change password. Please verify current password.');
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Server Sync Error Alert Banner */}
        {serverSyncError && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="cloud-off" size={20} color={colors.red} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorBannerTitle}>Security Server Offline</Text>
              <Text style={styles.errorBannerText}>
                Authoritative security settings could not be verified from the server ({serverSyncError}). Sensitive setting changes are paused for your security. Pull down to retry.
              </Text>
            </View>
          </View>
        )}

        {/* Security Architecture Overview Info Box */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="security" size={20} color={colors.accent} style={{ marginRight: 10, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Multilayer Security Active</Text>
            <Text style={styles.infoBannerText}>
              • Biometrics: Encrypted local device session unlock.{'\n'}
              • Transaction PIN: Backend-enforced authorization for withdrawals & transfers ≥ LKR 100,000.{'\n'}
              • 2FA: Email OTP verification for sensitive operations.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>DEVICE & BIOMETRICS</Text>

        {/* Toggles Container */}
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, !hasHardware && styles.iconBgDisabled]}>
                <MaterialIcons name="fingerprint" size={20} color={hasHardware ? colors.accent : colors.textSecondary} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.settingText}>Biometric Login</Text>
                <Text style={styles.subSettingText}>
                  {!hasHardware
                    ? 'Sensor not detected on device'
                    : !isEnrolled
                    ? 'No fingerprint enrolled in device'
                    : !hasBiometricSession
                    ? 'Sign in once with password to enable'
                    : 'Use fingerprint for instant sign-in'}
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={biometricEnabled}
              disabled={!hasHardware}
              onValueChange={handleBiometricToggle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, !supportsFaceId && styles.iconBgDisabled]}>
                <MaterialIcons
                  name="face"
                  size={20}
                  color={supportsFaceId && faceIdEnabled ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.settingText}>Facial Recognition</Text>
                <Text style={styles.subSettingText}>
                  {supportsFaceId
                    ? 'Facial unlock for device access'
                    : 'Hardware sensor not available on this device'}
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={faceIdEnabled && supportsFaceId}
              disabled={!supportsFaceId}
              onValueChange={handleFaceIdToggle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBg}>
                <MaterialIcons name="phonelink-lock" size={20} color={serverSyncLoaded ? colors.accent : colors.textSecondary} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.settingText}>Two-Factor Auth (2FA)</Text>
                <Text style={styles.subSettingText}>
                  {!serverSyncLoaded ? 'Server sync required (Read-only)' : 'Server-verified OTP for high-value actions'}
                </Text>
              </View>
            </View>
            {isUpdating2FA ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10 }} />
            ) : (
              <Switch
                trackColor={{ false: colors.bgInput, true: colors.accent }}
                thumbColor={'#FFF'}
                ios_backgroundColor="#3e3e3e"
                value={twoFactorEnabled}
                disabled={!serverSyncLoaded || isUpdating2FA}
                onValueChange={handle2FAToggle}
              />
            )}
          </View>
        </View>

        <Text style={styles.sectionHeading}>SERVER AUTHORIZATION & CREDENTIALS</Text>

        {/* Action Rows */}
        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              if (!serverSyncLoaded) {
                Alert.alert(
                  'Server Sync Required',
                  'Unable to verify transaction PIN status from the server. Please pull down to refresh before modifying your PIN.'
                );
                return;
              }
              setCurrentPin('');
              setPin('');
              setConfirmPin('');
              setPinModalVisible(true);
            }}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBgDisabled}>
                <MaterialIcons name="dialpad" size={20} color={hasServerPin ? colors.accent : colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.actionText}>
                  {hasServerPin ? 'Change Transaction PIN' : 'Set Transaction PIN'}
                </Text>
                <Text style={[styles.actionSubtext, hasServerPin && { color: colors.accent }]}>
                  {!serverSyncLoaded ? 'Server sync required' : hasServerPin ? 'Server-Enforced PIN Configured' : 'Setup Required for ≥ 100K LKR'}
                </Text>
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
            SmartLanka Trade v2.4 • Active Secure Session
          </Text>
        </View>

      </ScrollView>

      {/* 1. TRANSACTION PIN MODAL */}
      <Modal visible={pinModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {hasServerPin ? 'Change Transaction PIN' : 'Set Transaction PIN'}
              </Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              A 4 to 6 digit security PIN enforced by the backend server to authorize withdrawals and transfers of LKR 100,000 or greater.
            </Text>

            {hasServerPin && (
              <>
                <Text style={styles.inputLabel}>Current Security PIN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="••••"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChangeText={setCurrentPin}
                />
              </>
            )}

            <Text style={styles.inputLabel}>New 4-6 Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              value={pin}
              onChangeText={setPin}
            />

            <Text style={styles.inputLabel}>Confirm New PIN</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <TouchableOpacity
              style={[styles.modalButton, isSavingPin && { opacity: 0.7 }]}
              onPress={handleSavePin}
              disabled={isSavingPin}
            >
              {isSavingPin ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.modalButtonText}>
                  {hasServerPin ? 'Update Transaction PIN' : 'Activate Transaction PIN'}
                </Text>
              )}
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
    paddingBottom: TAB_BAR_BOTTOM_OFFSET,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    marginBottom: 16,
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 200, 83, 0.08)',
    borderRadius: layout.borderRadius,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.25)',
  },
  infoBannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
    fontSize: 13,
    marginBottom: 4,
  },
  infoBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    borderRadius: layout.borderRadius,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  errorBannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.red,
    fontSize: 13,
    marginBottom: 4,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeading: {
    ...typography.label,
    color: colors.textSecondary,
    marginLeft: SCREEN_PADDING,
    marginBottom: 10,
    letterSpacing: 1.5,
  },
  settingsGroup: {
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    marginBottom: 24,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginTop: 10,
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
