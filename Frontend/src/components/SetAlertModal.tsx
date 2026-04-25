import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../theme';
import { alertService } from '../services/apiService';

interface SetAlertModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
}

export const SetAlertModal: React.FC<SetAlertModalProps> = ({ visible, onClose, symbol, currentPrice }) => {
  const [targetPrice, setTargetPrice] = useState(currentPrice.toString());
  const [alertType, setAlertType] = useState<'ABOVE' | 'BELOW'>(
    parseFloat(targetPrice) > currentPrice ? 'ABOVE' : 'BELOW'
  );
  const [loading, setLoading] = useState(false);

  const handleSetAlert = async () => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid target price.');
      return;
    }

    setLoading(true);
    try {
      await alertService.createAlert(symbol, price, alertType);
      Alert.alert('Success', `Alert set for ${symbol} at Rs ${price}`);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.error || 'Failed to set alert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Set Price Alert</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.symbolText}>{symbol.replace('USDT', '')}/LKR</Text>
            <Text style={styles.currentPriceText}>
              Current Price: <Text style={{ color: colors.accent }}>Rs {currentPrice.toFixed(2)}</Text>
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Target Price (LKR)</Text>
              <TextInput
                style={styles.input}
                value={targetPrice}
                onChangeText={(text) => {
                    setTargetPrice(text);
                    const val = parseFloat(text);
                    if (!isNaN(val)) {
                        setAlertType(val > currentPrice ? 'ABOVE' : 'BELOW');
                    }
                }}
                keyboardType="numeric"
                placeholder="Enter price..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.typeContainer}>
              <Text style={styles.label}>Alert Me When</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    alertType === 'ABOVE' && styles.typeButtonActive,
                  ]}
                  onPress={() => setAlertType('ABOVE')}
                >
                  <Text style={[styles.typeButtonText, alertType === 'ABOVE' && styles.typeButtonTextActive]}>
                    Price Goes Above
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    alertType === 'BELOW' && styles.typeButtonActive,
                  ]}
                  onPress={() => setAlertType('BELOW')}
                >
                  <Text style={[styles.typeButtonText, alertType === 'BELOW' && styles.typeButtonTextActive]}>
                    Price Goes Below
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSetAlert}
                disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>Confirm Alert</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...typography.h3,
    color: '#FFF',
  },
  content: {
    alignItems: 'center',
  },
  symbolText: {
    ...typography.h2,
    color: colors.accent,
    marginBottom: 4,
  },
  currentPriceText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  typeContainer: {
    width: '100%',
    marginBottom: 32,
  },
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  typeButtonActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  typeButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: colors.accent,
  },
  submitButton: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
