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
import { colors } from '../theme';
import { walletService } from '../services/apiService';

interface WithdrawModalProps {
  isVisible: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess?: () => void;
}

type WithdrawMethod = 'BANK_ACCOUNT' | 'CARD' | 'EZCASH';

interface MethodOption {
  id: WithdrawMethod;
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  placeholder: string;
}

const WITHDRAW_METHODS: MethodOption[] = [
  { id: 'BANK_ACCOUNT', name: 'Bank Account', icon: 'account-balance', placeholder: 'e.g. 8001234567 (Commercial Bank)' },
  { id: 'CARD', name: 'Card Transfer', icon: 'credit-card', placeholder: 'e.g. 4111222233334567' },
  { id: 'EZCASH', name: 'eZ Cash', icon: 'phone-android', placeholder: 'e.g. 0771234567' },
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isVisible,
  onClose,
  availableBalance,
  onSuccess
}) => {
  const [step, setStep] = useState<'INPUT' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS'>('INPUT');
  const [amount, setAmount] = useState('25000');
  const [method, setMethod] = useState<WithdrawMethod>('BANK_ACCOUNT');
  const [destination, setDestination] = useState('8001234567');
  const [bankName, setBankName] = useState('Commercial Bank of Ceylon');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const resetState = () => {
    setStep('INPUT');
    setAmount('25000');
    setMethod('BANK_ACCOUNT');
    setDestination('8001234567');
    setBankName('Commercial Bank of Ceylon');
    setLoading(false);
    setReceipt(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const numAmount = parseFloat(amount || '0');
  const fee = 0.00;
  const youReceive = Math.max(0, numAmount - fee);

  const handleProceedToConfirm = () => {
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }

    if (numAmount > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You can withdraw up to LKR ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      );
      return;
    }

    if (!destination.trim()) {
      Alert.alert('Missing Destination', 'Please enter your destination account number or identifier.');
      return;
    }

    setStep('CONFIRM');
  };

  const handleExecuteWithdrawal = async () => {
    setLoading(true);
    setStep('PROCESSING');

    try {
      const idempotencyKey = `wth-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const response = await walletService.withdraw(
        numAmount,
        method,
        destination.trim(),
        method === 'BANK_ACCOUNT' ? bankName : undefined,
        idempotencyKey
      );

      if (response?.success) {
        setReceipt({
          transactionId: response.data.transactionId,
          reference: response.data.withdrawalReference,
          amount: numAmount,
          method,
          destinationMasked: response.data.destinationMasked,
          availableBalance: response.data.availableBalance,
          date: new Date().toLocaleString()
        });
        setStep('SUCCESS');
        if (onSuccess) onSuccess();
      } else {
        throw new Error(response?.message || 'Withdrawal request failed.');
      }
    } catch (error: any) {
      Alert.alert('Withdrawal Error', error.message || 'Failed to submit withdrawal request.');
      setStep('INPUT');
    } finally {
      setLoading(false);
    }
  };

  const getMethodName = (m: WithdrawMethod) => {
    return WITHDRAW_METHODS.find(i => i.id === m)?.name || m;
  };

  const maskedDestination = destination.length > 4 ? `****${destination.slice(-4)}` : destination;

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
                {step === 'INPUT' && 'Withdraw LKR'}
                {step === 'CONFIRM' && 'Confirm Withdrawal'}
                {step === 'PROCESSING' && 'Processing Withdrawal'}
                {step === 'SUCCESS' && 'Withdrawal Placed'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 'INPUT' && 'Transfer funds to your verified account'}
                {step === 'CONFIRM' && 'Review destination and amount'}
                {step === 'PROCESSING' && 'Deducting balance and queuing payout...'}
                {step === 'SUCCESS' && 'Funds are being dispatched'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: INPUT FORM */}
          {step === 'INPUT' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Available Cash Box */}
              <View style={styles.availableBox}>
                <Text style={styles.availableLabel}>AVAILABLE FOR WITHDRAWAL</Text>
                <Text style={styles.availableValue}>
                  LKR {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Amount Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>WITHDRAWAL AMOUNT</Text>
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
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => setAmount(availableBalance.toFixed(2))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Method Selector */}
              <Text style={styles.sectionTitle}>WITHDRAWAL METHOD</Text>
              <View style={styles.methodRow}>
                {WITHDRAW_METHODS.map((item) => {
                  const isSelected = method === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.methodPill, isSelected && styles.methodPillActive]}
                      onPress={() => setMethod(item.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={18}
                        color={isSelected ? '#080B11' : colors.accent}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.methodPillText, isSelected && styles.methodPillTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Destination Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>DESTINATION ACCOUNT NUMBER</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.amountInput, { fontSize: 16 }]}
                    value={destination}
                    onChangeText={setDestination}
                    placeholder="Enter account number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Fee & Summary Breakdown */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Withdrawal Fee</Text>
                  <Text style={styles.summaryFree}>LKR 0.00 (Free Promotional)</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>You Receive</Text>
                  <Text style={styles.summaryValueBold}>
                    LKR {youReceive.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
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
                  <Text style={styles.confirmLabel}>Amount</Text>
                  <Text style={styles.confirmValueBold}>
                    LKR {numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Method</Text>
                  <Text style={styles.confirmValue}>{getMethodName(method)}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Destination</Text>
                  <Text style={styles.confirmValueAccent}>{maskedDestination}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Fee</Text>
                  <Text style={styles.confirmFreeText}>LKR 0.00</Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabelBold}>You Receive</Text>
                  <Text style={styles.confirmValueAccentLarge}>
                    LKR {youReceive.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
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
                  onPress={handleExecuteWithdrawal}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>Confirm Withdrawal</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: PROCESSING */}
          {step === 'PROCESSING' && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 20 }} />
              <Text style={styles.statusTitle}>Submitting Withdrawal</Text>
              <Text style={styles.statusSub}>
                Locking funds and queuing payout request through LankaPay banking network...
              </Text>
            </View>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {step === 'SUCCESS' && receipt && (
            <View>
              <View style={styles.successIconCircle}>
                <MaterialIcons name="done-all" size={32} color="#080B11" />
              </View>

              <View style={styles.receiptBox}>
                <Text style={styles.receiptAmount}>
                  - LKR {receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.receiptSub}>Withdrawal Request Placed</Text>

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
                  <Text style={styles.confirmLabel}>Destination</Text>
                  <Text style={styles.confirmValueAccent}>{receipt.destinationMasked}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Status</Text>
                  <Text style={styles.confirmValueYellow}>PROCESSING</Text>
                </View>
                {receipt.availableBalance !== undefined && (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Remaining Cash</Text>
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
    marginBottom: 18,
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
  availableBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  availableLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  availableValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.accent,
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
    height: 58,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  maxBtn: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgInput,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  methodPillTextActive: {
    color: '#080B11',
  },
  summaryCard: {
    backgroundColor: colors.bgInput,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryFree: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
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
  },
  confirmLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  confirmValueAccentLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  confirmValueYellow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFB300',
  },
  confirmFreeText: {
    fontSize: 13,
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
    color: '#FF5252',
    textAlign: 'center',
  },
  receiptSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
