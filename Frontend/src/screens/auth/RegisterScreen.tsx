import * as React from 'react';
const { useState } = React;
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton } from '../../components';
import { authService } from '../../services/apiService';

export const RegisterScreen = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { height } = Dimensions.get('window');
  const isSmallDevice = height < 700;

  // Very basic strength calculation for UI
  const getStrengthLevel = () => {
    if (password.length === 0) return 0;
    if (password.length < 6) return 1;
    if (password.length < 8) return 2;
    return 3;
  };

  const strength = getStrengthLevel();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register(name, email, password);
      Alert.alert('Success', 'Registration successful! Please check your email for verification.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.error || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              iconLeft={<MaterialIcons name="lock-outline" size={20} color={colors.textSecondary} />}
              iconRight={<MaterialIcons name="visibility-off" size={20} color={colors.textSecondary} />}
            />

            {/* Password Strength UI */}
            <View style={styles.strengthContainer}>
              <View style={[styles.strengthBar, strength >= 1 && styles.strengthActive]} />
              <View style={[styles.strengthBar, strength >= 2 && styles.strengthActive]} />
              <View style={[styles.strengthBar, strength >= 3 && styles.strengthActive]} />
              <View style={styles.strengthBar} />
            </View>
            <View style={styles.strengthTextRow}>
              <Text style={[styles.strengthLabel, strength >= 3 && { color: colors.accent }]}>
                STRENGTH: {strength >= 3 ? 'STRONG' : strength > 0 ? 'WEAK' : 'NONE'}
              </Text>
              <Text style={styles.minCharText}>Min. 8 characters</Text>
            </View>

            <Text style={styles.sectionLabel}>CONFIRM PASSWORD</Text>
            <InputField
              placeholder="••••••••"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              iconLeft={<MaterialIcons name="loop" size={20} color={colors.textSecondary} />}
            />

            <View style={styles.termsContainer}>
              <MaterialIcons name="radio-button-unchecked" size={24} color={colors.textSecondary} />
              <Text style={styles.termsText}>
                By creating an account, I agree to the <Text style={styles.greenLink}>Terms of Service</Text> and <Text style={styles.greenLink}>Privacy Policy</Text>.
              </Text>
            </View>

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
