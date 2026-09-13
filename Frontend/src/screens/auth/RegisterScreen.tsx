import * as React from 'react';
const { useState } = React;
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';

export const RegisterScreen = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  // Toast & Network states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

  const { height } = Dimensions.get('window');
  const isSmallDevice = height < 700;

  // Password requirements checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const getStrengthLevel = () => {
    let score = 0;
    if (password.length === 0) return 0;
    if (hasMinLength) score++;
    if (hasUppercase && hasLowercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    return score; // Max 4
  };

  const strength = getStrengthLevel();

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    // Email basic check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }

    // Password policy check
    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      showToast('Password does not meet complexity requirements.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }

    if (!agree) {
      showToast('You must agree to the Terms of Service and Privacy Policy', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      await authService.register(name.trim(), email.trim(), password);
      showToast('Account created! Verification code sent to your email.', 'success');
      setTimeout(() => {
        navigation.navigate('OTPVerification', { email: email.trim() });
      }, 1200);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Registration failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && (
        <NetworkErrorScreen
          onRetry={() => {
            setIsNetworkError(false);
            handleRegister();
          }}
        />
      )}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Trade Account</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Join SmartLanka Trade</Text>
            <Text style={styles.description}>
              Enter your details below to start managing your digital assets with institutional-grade security.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>FULL NAME</Text>
            <InputField
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              iconLeft={<MaterialIcons name="person-outline" size={20} color={colors.textSecondary} />}
            />

            <Text style={styles.sectionLabel}>EMAIL ADDRESS</Text>
            <InputField
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              iconLeft={<MaterialIcons name="mail-outline" size={20} color={colors.textSecondary} />}
            />

            <Text style={styles.sectionLabel}>PASSWORD</Text>
            <InputField
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              iconLeft={<MaterialIcons name="lock-outline" size={20} color={colors.textSecondary} />}
              iconRight={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              }
            />

            {/* Password Strength UI */}
            <View style={styles.strengthContainer}>
              <View style={[styles.strengthBar, strength >= 1 && styles.strengthActive]} />
              <View style={[styles.strengthBar, strength >= 2 && styles.strengthActive]} />
              <View style={[styles.strengthBar, strength >= 3 && styles.strengthActive]} />
              <View style={[styles.strengthBar, strength >= 4 && styles.strengthActive]} />
            </View>
            <View style={styles.strengthTextRow}>
              <Text style={[styles.strengthLabel, strength >= 4 && { color: colors.accent }]}>
                STRENGTH: {strength >= 4 ? 'STRONG' : strength >= 2 ? 'MEDIUM' : strength > 0 ? 'WEAK' : 'NONE'}
              </Text>
            </View>

            {/* Password Checklist */}
            <View style={styles.checklistContainer}>
              <View style={styles.checklistItem}>
                <MaterialIcons
                  name={hasMinLength ? "check-circle" : "radio-button-unchecked"}
                  size={14}
                  color={hasMinLength ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.checklistText, hasMinLength && styles.checklistTextActive]}>Min. 8 characters</Text>
              </View>
              <View style={styles.checklistItem}>
                <MaterialIcons
                  name={hasUppercase ? "check-circle" : "radio-button-unchecked"}
                  size={14}
                  color={hasUppercase ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.checklistText, hasUppercase && styles.checklistTextActive]}>At least one uppercase letter</Text>
              </View>
              <View style={styles.checklistItem}>
                <MaterialIcons
                  name={hasLowercase ? "check-circle" : "radio-button-unchecked"}
                  size={14}
                  color={hasLowercase ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.checklistText, hasLowercase && styles.checklistTextActive]}>At least one lowercase letter</Text>
              </View>
              <View style={styles.checklistItem}>
                <MaterialIcons
                  name={hasNumber ? "check-circle" : "radio-button-unchecked"}
                  size={14}
                  color={hasNumber ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.checklistText, hasNumber && styles.checklistTextActive]}>At least one number</Text>
              </View>
              <View style={styles.checklistItem}>
                <MaterialIcons
                  name={hasSpecial ? "check-circle" : "radio-button-unchecked"}
                  size={14}
                  color={hasSpecial ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.checklistText, hasSpecial && styles.checklistTextActive]}>Special character (@$!%*?&)</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>CONFIRM PASSWORD</Text>
            <InputField
              placeholder="••••••••"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              iconLeft={<MaterialIcons name="loop" size={20} color={colors.textSecondary} />}
              iconRight={
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              }
            />

            <TouchableOpacity
              style={styles.termsContainer}
              activeOpacity={0.8}
              onPress={() => setAgree(!agree)}
            >
              <MaterialIcons
                name={agree ? "radio-button-checked" : "radio-button-unchecked"}
                size={24}
                color={agree ? colors.accent : colors.textSecondary}
              />
              <Text style={styles.termsText}>
                By creating an account, I agree to the <Text style={styles.greenLink}>Terms of Service</Text> and <Text style={styles.greenLink}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
            ) : (
              <PrimaryButton
                title="CREATE ACCOUNT >"
                onPress={handleRegister}
                style={styles.createBtn}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text
                style={styles.greenLinkBold}
                onPress={() => navigation.navigate('Login')}
              >
                Log In
              </Text>
            </Text>
          </View>

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
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  titleSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  mainTitle: {
    ...typography.h1,
    marginBottom: 12,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  formSection: {
    width: '100%',
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: 8,
    marginTop: 8,
  },
  strengthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: -8,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    backgroundColor: colors.border,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  strengthActive: {
    backgroundColor: colors.accent,
  },
  strengthTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  strengthLabel: {
    ...typography.label,
  },
  minCharText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  checklistContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checklistText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },
  checklistTextActive: {
    color: colors.accent,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 32,
  },
  termsText: {
    ...typography.bodySmall,
    flex: 1,
    marginLeft: 12,
    lineHeight: 20,
  },
  greenLink: {
    color: colors.accent,
  },
  createBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  greenLinkBold: {
    color: colors.accent,
    fontWeight: '700',
  },
});
