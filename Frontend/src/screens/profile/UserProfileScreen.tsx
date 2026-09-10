import * as React from 'react';
const { useEffect, useState } = React;
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import { authService, kycService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

const menuItems = [
  { id: 'kyc', title: 'KYC Identity Verification', icon: 'verified-user', screen: 'KYCVerification' },
  { id: '1', title: 'Security & Privacy', icon: 'security', screen: 'SecuritySettings' },
  { id: '2', title: 'Currency Conversion', icon: 'currency-exchange', screen: 'CurrencyConversion' },
  { id: '3', title: 'Trading Limits & Fees', icon: 'assessment' },
  { id: '4', title: 'Connected Devices', icon: 'devices', screen: 'SecuritySettings' },
  { id: '5', title: 'Help & Support', icon: 'help-outline' },
  { id: '6', title: 'About SmartLanka', icon: 'info-outline' },
];

export const UserProfileScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    phoneNumber?: string | null;
    profileImage?: string | null
  } | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('NOT_SUBMITTED');
  const [loadingKyc, setLoadingKyc] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Functional Preferences
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Modals
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy Masking Toggles
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'KP';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'KP';
  };

  const getMaskedEmail = (emailStr?: string, show?: boolean) => {
    if (!emailStr) return '•••••••@gmail.com';
    if (show) return emailStr;
    const parts = emailStr.split('@');
    if (parts.length === 2) {
      return '•••••••@' + parts[1];
    }
    return '••••••••';
  };

  const getMaskedPhone = (phoneStr?: string, show?: boolean) => {
    if (!phoneStr) return '+94 7• ••• ••42';
    if (show) return phoneStr;
    const clean = phoneStr.trim();
    if (clean.startsWith('+94')) {
      const rest = clean.slice(3).trim();
      const firstDigit = rest.charAt(0) || '7';
      const lastTwo = rest.slice(-2) || '42';
      return `+94 ${firstDigit}• ••• ••${lastTwo}`;
    }
    if (clean.length >= 7) {
      const prefix = clean.slice(0, 3);
      const suffix = clean.slice(-2);
      return `${prefix}• ••• ••${suffix}`;
    }
    return '+94 7• ••• ••42';
  };

  const loadUserProfile = async () => {
    try {
      const userData = await storageService.getUserData();
      if (userData) {
        setUser(userData);
      }

      const res = await authService.getProfile();
      if (res?.user) {
        setUser(res.user);
        await storageService.setUserData(res.user);
      }
    } catch (err) {
      // Offline fallback
    }

    const bio = await AsyncStorage.getItem('@pref_biometric');
    if (bio !== null) setBiometricEnabled(bio === 'true');

    const push = await AsyncStorage.getItem('@pref_push_notifications');
    if (push !== null) setPushEnabled(push === 'true');
  };

  useEffect(() => {
    loadUserProfile();
  }, [isFocused]);

  const fetchKyc = async () => {
    try {
      setLoadingKyc(true);
      const res = await kycService.getKYCStatus();
      if (res?.data?.status) {
        setKycStatus(res.data.status);
      }
    } catch (e) {
      // Not authenticated or offline
    } finally {
      setLoadingKyc(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchKyc();
    }
  }, [isFocused]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserProfile(), fetchKyc()]);
    setRefreshing(false);
  };

  const handleOpenEditModal = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.phoneNumber || '');
    setEditImage(user?.profileImage || null);
    setEditProfileModalVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to select a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setEditImage(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setEditImage(asset.uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Image Error', err.message || 'Could not select image.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setEditImage(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setEditImage(asset.uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not launch camera.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    if (!editEmail.trim() || !editEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await authService.updateProfile({
        name: editName.trim(),
        email: editEmail.trim(),
        phoneNumber: editPhone.trim() || undefined,
        profileImage: editImage
      });

      if (res?.user) {
        setUser(res.user);
        await storageService.setUserData(res.user);
      }

      setEditProfileModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been successfully updated.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile.';
      Alert.alert('Update Failed', msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBiometricToggle = async (val: boolean) => {
    setBiometricEnabled(val);
    await AsyncStorage.setItem('@pref_biometric', String(val));
    if (val) {
      Alert.alert('Biometrics Enabled', 'Biometric authentication is active for fast sign-in.');
    } else {
      Alert.alert('Biometrics Disabled', 'Standard password login is now required.');
    }
  };

  const handlePushToggle = async (val: boolean) => {
    setPushEnabled(val);
    await AsyncStorage.setItem('@pref_push_notifications', String(val));
    if (val) {
      Alert.alert('Push Notifications Enabled', 'You will receive real-time price alerts and trade execution notifications.');
    } else {
      Alert.alert('Push Notifications Disabled', 'Notification alerts muted.');
    }
  };

  const handleMenuItemPress = (item: any) => {
    if (item.screen) {
      navigation.navigate(item.screen);
      return;
    }
    if (item.id === '3') {
      setLimitsModalVisible(true);
    } else if (item.id === '5') {
      setSupportModalVisible(true);
    } else if (item.id === '6') {
      setAboutModalVisible(true);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          });
        }
      }
    ]);
  };

  const getTierBadge = () => {
    if (loadingKyc) {
      return (
        <View style={[styles.tierBadge, { backgroundColor: colors.bgInput }]}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      );
    }
    if (kycStatus === 'VERIFIED') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.accentMuted }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="verified" size={14} color={colors.accent} />
          <Text style={[styles.tierText, { color: colors.accent }]}>Tier 2 Verified</Text>
        </TouchableOpacity>
      );
    }
    if (kycStatus === 'PENDING') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.yellow + '33' }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="pending-actions" size={14} color={colors.yellow} />
          <Text style={[styles.tierText, { color: colors.yellow }]}>KYC Pending Review</Text>
        </TouchableOpacity>
      );
    }
    if (kycStatus === 'REJECTED') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.red + '33' }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="error" size={14} color={colors.red} />
          <Text style={[styles.tierText, { color: colors.red }]}>KYC Rejected (Retry)</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.bgInput }]} onPress={() => navigation.navigate('KYCVerification')}>
        <MaterialIcons name="shield" size={14} color={colors.textSecondary} />
        <Text style={[styles.tierText, { color: colors.textSecondary }]}>Verify Identity (KYC)</Text>
      </TouchableOpacity>
    );
  };

  const renderHeaderKycBadge = () => {
    if (loadingKyc) {
      return (
        <View style={[styles.verifiedBadge, { backgroundColor: '#161D2B', borderColor: '#242F45', minWidth: 60, alignItems: 'center' }]}>
          <ActivityIndicator size={10} color="#00E676" />
        </View>
      );
    }

    if (kycStatus === 'VERIFIED') {
      return (
        <TouchableOpacity
          style={styles.verifiedBadge}
          onPress={() => navigation.navigate('KYCVerification')}
          activeOpacity={0.7}
        >
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </TouchableOpacity>
      );
    }

    if (kycStatus === 'PENDING') {
      return (
        <TouchableOpacity
          style={[styles.verifiedBadge, { backgroundColor: '#2D2305', borderColor: '#FFB30044' }]}
          onPress={() => navigation.navigate('KYCVerification')}
          activeOpacity={0.7}
        >
          <Text style={[styles.verifiedBadgeText, { color: '#FFB300' }]}>PENDING</Text>
        </TouchableOpacity>
      );
    }

    if (kycStatus === 'REJECTED') {
      return (
        <TouchableOpacity
          style={[styles.verifiedBadge, { backgroundColor: '#2E1114', borderColor: '#FF525244' }]}
          onPress={() => navigation.navigate('KYCVerification')}
          activeOpacity={0.7}
        >
          <Text style={[styles.verifiedBadgeText, { color: '#FF5252' }]}>REJECTED</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.verifiedBadge, { backgroundColor: '#161D2B', borderColor: '#242F45' }]}
        onPress={() => navigation.navigate('KYCVerification')}
        activeOpacity={0.7}
      >
        <Text style={[styles.verifiedBadgeText, { color: '#8B949E' }]}>UNVERIFIED</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.container}
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
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SecuritySettings')}>
            <MaterialIcons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <Card style={styles.userCard}>
          {/* Top Profile Header */}
          <View style={styles.profileHeaderRow}>
            <TouchableOpacity onPress={handleOpenEditModal} activeOpacity={0.8} style={styles.avatarContainer}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarInitialsContainer}>
                  <Text style={styles.avatarInitialsText}>{getInitials(user?.name)}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileHeaderTextGroup}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.profileNameText} numberOfLines={1}>
                  {user?.name || 'Kasun Perera'}
                </Text>
                {renderHeaderKycBadge()}
              </View>
              <Text style={styles.memberSinceText}>Member since Mar 2026</Text>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={handleOpenEditModal}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={13} color="#00E676" style={styles.editIcon} />
              <Text style={styles.editProfileBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.userCardDivider} />

          {/* Email Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoValueGroup}>
              <Text style={styles.infoValueText}>
                {getMaskedEmail(user?.email || 'kasunperera@gmail.com', showEmail)}
              </Text>
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowEmail(!showEmail)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showEmail ? "visibility" : "visibility-off"}
                  size={16}
                  color="#8B949E"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Phone Row */}
          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.infoValueGroup}>
              <Text style={styles.infoValueText}>
                {getMaskedPhone(user?.phoneNumber || '+94771234542', showPhone)}
              </Text>
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPhone(!showPhone)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPhone ? "visibility" : "visibility-off"}
                  size={16}
                  color="#8B949E"
                />
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Preferences Toggle Row */}
        <View style={styles.preferencesSection}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="fingerprint" size={24} color={colors.accent} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefText}>Biometric Login</Text>
                <Text style={styles.prefSubtext}>Fingerprint & Face authentication</Text>
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
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="notifications-active" size={24} color={colors.accent} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefText}>Push Notifications</Text>
                <Text style={styles.prefSubtext}>Price alerts and order executions</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={pushEnabled}
              onValueChange={handlePushToggle}
            />
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuItemPress(item)}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, item.id === 'kyc' && { backgroundColor: colors.accentMuted }]}>
                  <MaterialIcons
                    name={item.icon as any}
                    size={20}
                    color={item.id === 'kyc' ? colors.accent : colors.textPrimary}
                  />
                </View>
                <Text style={[styles.menuTitle, item.id === 'kyc' && { fontWeight: '700' }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>

              <View style={styles.menuRight}>
                {item.id === 'kyc' && (
                  <View style={[
                    styles.menuBadgePill,
                    { backgroundColor: kycStatus === 'VERIFIED' ? colors.accentMuted : colors.yellow + '22' }
                  ]}>
                    <Text style={[
                      styles.menuBadgeText,
                      { color: kycStatus === 'VERIFIED' ? colors.accent : colors.yellow }
                    ]}>
                      {kycStatus === 'VERIFIED' ? 'Verified' : kycStatus === 'PENDING' ? 'Pending' : 'Required'}
                    </Text>
                  </View>
                )}
                {item.id === '4' && (
                  <View style={[styles.menuBadgePill, { backgroundColor: colors.accentMuted }]}>
                    <Text style={[styles.menuBadgeText, { color: colors.accent }]}>
                      2 Active
                    </Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={colors.red} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />

      </ScrollView>

      {/* ============================================================ */}
      {/* 0. EDIT PROFILE MODAL */}
      {/* ============================================================ */}
      <Modal visible={editProfileModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="edit" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Edit Profile</Text>
              </View>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Profile Image Picker Area */}
              <View style={styles.imagePickerSection}>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.modalAvatarWrapper}>
                  {editImage ? (
                    <Image source={{ uri: editImage }} style={styles.modalAvatarImage} />
                  ) : (
                    <View style={styles.modalAvatarPlaceholder}>
                      <MaterialIcons name="person" size={50} color={colors.accent} />
                    </View>
                  )}
                  <View style={styles.modalAvatarCamIcon}>
                    <MaterialIcons name="camera-alt" size={16} color="#FFF" />
                  </View>
                </TouchableOpacity>

                <View style={styles.imageBtnRow}>
                  <TouchableOpacity style={styles.imageActionBtn} onPress={handlePickImage}>
                    <MaterialIcons name="photo-library" size={16} color={colors.accent} />
                    <Text style={styles.imageActionBtnText}>Choose Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageActionBtn} onPress={handleTakePhoto}>
                    <MaterialIcons name="photo-camera" size={16} color={colors.accent} />
                    <Text style={styles.imageActionBtnText}>Take Photo</Text>
                  </TouchableOpacity>
                  {editImage && (
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { borderColor: colors.red + '44' }]}
                      onPress={() => setEditImage(null)}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={colors.red} />
                      <Text style={[styles.imageActionBtnText, { color: colors.red }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Input Fields */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="person" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.textSecondary}
                    value={editName}
                    onChangeText={setEditName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="email" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textSecondary}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number (Sri Lanka / Intl)</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="phone" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="+94 77 123 4567"
                    placeholderTextColor={colors.textSecondary}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditProfileModalVisible(false)}
                disabled={savingProfile}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 1. TRADING LIMITS & FEES MODAL */}
      <Modal visible={limitsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trading Limits & Fees</Text>
              <TouchableOpacity onPress={() => setLimitsModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Virtual Demo Trading</Text>
                  <Text style={[styles.limitValue, { color: colors.accent }]}>UNLIMITED</Text>
                </View>
                <Text style={styles.limitSub}>Virtual balance: LKR 1,000,000.00 with zero risk simulation</Text>
              </View>

              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Daily LKR Deposit Limit</Text>
                  <Text style={styles.limitValue}>LKR 5,000,000</Text>
                </View>
                <Text style={styles.limitSub}>Tier 2 Verified Account via direct bank wire / CEFTS</Text>
              </View>

              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Daily Crypto Withdrawal</Text>
                  <Text style={styles.limitValue}>2.000000 BTC</Text>
                </View>
                <Text style={styles.limitSub}>24-hour rolling security limit with 2FA enforcement</Text>
              </View>

              <View style={styles.feeBreakdown}>
                <Text style={styles.feeTitle}>FEE SCHEDULE</Text>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Maker Fee</Text>
                  <Text style={styles.feeValue}>0.10%</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Taker Fee</Text>
                  <Text style={styles.feeValue}>0.15%</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Sri Lanka Tax (WHT)</Text>
                  <Text style={[styles.feeValue, { color: colors.accent }]}>0.00% (Exempt)</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setLimitsModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. ABOUT SMARTLANKA MODAL */}
      <Modal visible={aboutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About SmartLanka Trade</Text>
              <TouchableOpacity onPress={() => setAboutModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={styles.aboutLogoBg}>
                <MaterialIcons name="trending-up" size={36} color={colors.accent} />
              </View>
              <Text style={styles.aboutAppName}>SmartLanka Trade</Text>
              <Text style={styles.aboutVersion}>Version 2.4.0 (Build 2026.09)</Text>
            </View>

            <Text style={styles.aboutDesc}>
              Sri Lanka's leading digital trading terminal combining CSE equities with global crypto assets. Features AI technical signal generation (SOMI Engine), real-time LKR exchange rate conversion, and automated Sri Lankan NIC OCR verification.
            </Text>

            <View style={styles.certRow}>
              <MaterialIcons name="security" size={16} color={colors.accent} />
              <Text style={styles.certText}>256-Bit SSL Encryption • Oracle ACID Database</Text>
            </View>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setAboutModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. HELP & SUPPORT MODAL */}
      <Modal visible={supportModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <TouchableOpacity onPress={() => setSupportModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.supportOption}
              onPress={() => {
                setSupportModalVisible(false);
                navigation.navigate('SOMIAIChat');
              }}
            >
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="smart-toy" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Chat with SOMI AI</Text>
                <Text style={styles.supportOptionSub}>Get instant answers on trading, signals & portfolio</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportOption}
              onPress={() => {
                Alert.alert('Official Email Support', 'Reach us anytime at:\n\nsupport@smartlanka.trade\n\nResponse time: Under 1 hour.');
              }}
            >
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="mail-outline" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Official Email Support</Text>
                <Text style={styles.supportOptionSub}>support@smartlanka.trade</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setSupportModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
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
    marginBottom: 24,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadiusSmall,
  },
  userCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarInitialsContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  profileHeaderTextGroup: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 6,
    maxWidth: '65%',
  },
  verifiedBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  verifiedBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editIcon: {
    marginRight: 5,
  },
  editProfileBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  memberSinceText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userCardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValueText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  eyeBtn: {
    padding: 5,
    backgroundColor: colors.bgInput,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSmall,
    marginTop: 2,
  },
  tierText: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginLeft: 4,
  },
  preferencesSection: {
    backgroundColor: colors.bgCard,
    marginHorizontal: 24,
    borderRadius: layout.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prefIcon: {
    marginRight: 16,
  },
  prefText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  prefSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuSection: {
    backgroundColor: colors.bgCard,
    marginHorizontal: 24,
    borderRadius: layout.borderRadius,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: layout.borderRadiusSmall,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTitle: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.redMuted,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.red,
  },
  // Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Edit Profile Modal Specific
  imagePickerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  modalAvatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  modalAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  modalAvatarCamIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  imageBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageActionBtnText: {
    ...typography.bodySmall,
    color: '#FFF',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    ...typography.body,
    color: '#000',
    fontWeight: '700',
  },
  // Trading Limits Specific
  limitCard: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  limitTierTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  limitValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
  },
  limitSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  feeBreakdown: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeTitle: {
    ...typography.label,
    color: colors.accent,
    marginBottom: 10,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  feeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  feeValue: {
    ...typography.bodySmall,
    color: '#FFF',
    fontWeight: '600',
  },
  aboutLogoBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutAppName: {
    ...typography.h2,
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  aboutVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  aboutDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginVertical: 12,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 8,
  },
  certText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  supportOptionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  supportOptionSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  modalDoneBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  modalDoneBtnText: {
    ...typography.body,
    color: '#000',
    fontWeight: '700',
  },
});
