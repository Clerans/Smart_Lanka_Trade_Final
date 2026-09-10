import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import { walletService } from '../services/apiService';

interface DepositModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethod = 'CARD' | 'BANK' | 'EZCASH' | 'JUSTPAY';

interface MethodOption {
  id: PaymentMethod;
  name: string;
  sub: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  badge?: string;
}

const PAYMENT_METHODS: MethodOption[] = [
  { id: 'BANK', name: 'Bank Account', sub: 'Direct bank transfer / CEFTS wire', icon: 'account-balance' },
  { id: 'CARD', name: 'Debit / Credit Card', sub: 'Visa, Mastercard & UnionPay', icon: 'credit-card', badge: 'Instant' },
  { id: 'EZCASH', name: 'eZ Cash', sub: 'Dialog Axiata mobile money', icon: 'phone-android' },
  { id: 'JUSTPAY', name: 'JustPay', sub: 'LankaPay inter-bank instant debit', icon: 'flash-on', badge: 'Fast' },
];

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export const DepositModal: React.FC<DepositModalProps> = ({ isVisible, onClose, onSuccess }) => {
  const [step, setStep] = useState<'INPUT' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS'>('INPUT');
  const [amount, setAmount] = useState('25000');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CARD');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const resetState = () => {
    setStep('INPUT');
    setAmount('25000');
    setSelectedMethod('CARD');
    setLoading(false);
    setReceipt(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleProceedToConfirm = () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to deposit.');
      return;
    }
    setStep('CONFIRM');
  };

  const handleExecuteDeposit = async () => {
    const numAmount = parseFloat(amount);
    setLoading(true);
    setStep('PROCESSING');

    try {
      // Step 1: Initiate payment intent
      const idempotencyKey = `dep-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const initRes = await walletService.initiateDeposit(numAmount, selectedMethod, idempotencyKey);

      if (!initRes?.success) {
        throw new Error(initRes?.message || 'Failed to initialize deposit intent.');
      }

      // Step 2: Settle payment with simulated provider
      const settleRes = await walletService.verifyDeposit(
        initRes.data.transactionId,
        initRes.data.providerReference
      );

      if (settleRes?.success) {
        setReceipt({
          transactionId: settleRes.data.transactionId,
          reference: settleRes.data.providerReference,
          amount: numAmount,
          method: selectedMethod,
          availableBalance: settleRes.data.availableBalance,
          date: new Date().toLocaleString()
        });
        setStep('SUCCESS');
        onSuccess();
      } else {
        throw new Error(settleRes?.message || 'Payment settlement failed.');
      }
    } catch (error: any) {
      Alert.alert('Deposit Error', error.message || 'Failed to complete deposit. Please try again.');
      setStep('INPUT');
    } finally {
      setLoading(false);
    }
  };

  const getMethodName = (m: PaymentMethod) => {
    return PAYMENT_METHODS.find(item => item.id === m)?.name || m;
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {step === 'INPUT' && 'Deposit LKR'}
                {step === 'CONFIRM' && 'Confirm Deposit'}
                {step === 'PROCESSING' && 'Payment Processing'}
                {step === 'SUCCESS' && 'Deposit Successful'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 'INPUT' && 'Select method and funding amount'}
                {step === 'CONFIRM' && 'Review deposit details'}
                {step === 'PROCESSING' && 'Simulating provider verification...'}
                {step === 'SUCCESS' && 'Funds credited to your trading wallet'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: INPUT & METHOD SELECTION */}
          {step === 'INPUT' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Amount Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>AMOUNT</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencyPrefix}>Rs</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Quick Amount Pills */}
              <View style={styles.quickAmountsRow}>
                {QUICK_AMOUNTS.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.quickAmountBtn,
                      amount === amt.toString() && styles.quickAmountBtnActive
                    ]}
                    onPress={() => setAmount(amt.toString())}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        amount === amt.toString() && styles.quickAmountTextActive
                      ]}
                    >
                      +{amt.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Payment Method Selector */}
              <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
              <View style={styles.methodsList}>
                {PAYMENT_METHODS.map((item) => {
                  const isSelected = selectedMethod === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.methodCard, isSelected && styles.methodCardSelected]}
                      onPress={() => setSelectedMethod(item.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.methodIconBox, isSelected && styles.methodIconBoxSelected]}>
                        <MaterialIcons
                          name={item.icon}
                          size={22}
                          color={isSelected ? '#080B11' : colors.accent}
                        />
                      </View>
                      <View style={styles.methodInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.methodName, isSelected && styles.methodNameSelected]}>
                            {item.name}
                          </Text>
                          {item.badge && (
                            <View style={styles.methodBadge}>
                              <Text style={styles.methodBadgeText}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.methodSub}>{item.sub}</Text>
                      </View>
                      <MaterialIcons
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={isSelected ? colors.accent : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleProceedToConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP 2: CONFIRMATION */}
          {step === 'CONFIRM' && (
            <View>
              <View style={styles.confirmBox}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Deposit Amount</Text>
                  <Text style={styles.confirmValueBold}>
                    LKR {parseFloat(amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Payment Method</Text>
                  <Text style={styles.confirmValue}>{getMethodName(selectedMethod)}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Payment Provider</Text>
                  <Text style={styles.confirmValueAccent}>SmartLanka Trade Demo Gateway</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Provider Status</Text>
                  <View style={styles.readyBadge}>
                    <View style={styles.readyDot} />
                    <Text style={styles.readyBadgeText}>Ready to Process</Text>
                  </View>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Processing Fee</Text>
                  <Text style={styles.confirmFreeText}>LKR 0.00 (Free)</Text>
                </View>
              </View>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep('INPUT')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPrimaryBtn}
                  onPress={handleExecuteDeposit}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>Continue Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: PROCESSING */}
          {step === 'PROCESSING' && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 20 }} />
              <Text style={styles.statusTitle}>Simulating Payment Flow</Text>
              <Text style={styles.statusSub}>
                Connecting to {getMethodName(selectedMethod)} simulator and verifying response...
              </Text>
            </View>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {step === 'SUCCESS' && receipt && (
            <View>
              <View style={styles.successIconCircle}>
                <MaterialIcons name="check" size={32} color="#080B11" />
              </View>

              <View style={styles.receiptBox}>
                <Text style={styles.receiptAmount}>
                  + LKR {receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.receiptSub}>Deposit Settled Successfully</Text>

                <View style={styles.confirmDivider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Transaction ID</Text>
                  <Text style={styles.confirmValue}>#{receipt.transactionId}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Reference</Text>
                  <Text style={[styles.confirmValue, { fontSize: 11 }]}>{receipt.reference}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Method</Text>
                  <Text style={styles.confirmValue}>{getMethodName(receipt.method)}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Status</Text>
                  <Text style={styles.confirmValueAccent}>COMPLETED</Text>
                </View>
                {receipt.availableBalance !== undefined && (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Updated Cash</Text>
                    <Text style={styles.confirmValueBold}>
                      LKR {receipt.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleClose}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    minHeight: 450,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.accent,
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  quickAmountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickAmountTextActive: {
    color: colors.accent,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  methodsList: {
    marginBottom: 24,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#0F261D',
  },
  methodIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodIconBoxSelected: {
    backgroundColor: colors.accent,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  methodNameSelected: {
    color: colors.textPrimary,
  },
  methodSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  methodBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  methodBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#080B11',
  },
  confirmBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  confirmLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmValueBold: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  confirmValueAccent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  confirmFreeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  readyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
  },
  backBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmPrimaryBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerStatusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  statusSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  receiptAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
  },
  receiptSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
