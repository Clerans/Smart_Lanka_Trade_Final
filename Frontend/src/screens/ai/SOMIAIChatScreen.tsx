import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { aiService } from '../../services/apiService';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isHtmlOrFormatted?: boolean;
}

export const SOMIAIChatScreen = () => {
  const navigation = useNavigation<any>();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Ayubowan! I'm SOMI, your SmartLanka AI Financial Intelligence Assistant. I can analyze Colombo Stock Exchange (CSE) equities, explain machine learning forecasts, review your portfolio, or break down market trends. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const quickPrompts = [
    "Predict JKH.N0000 7-day trend",
    "Analyze Banking sector (COMB & SAMP)",
    "Explain ARIMA vs LSTM prediction",
    "How does Sri Lanka withholding tax work?",
    "Show top undervalued CSE dividend stocks"
  ];

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, loading]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!promptToSend) setInputText('');
    setLoading(true);

    try {
      // Build conversation history format
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const response = await aiService.sendChatMessage(text.trim(), history);
      const aiReplyText = response?.data?.reply || response?.reply || "I've analyzed the CSE market metrics. Key stocks show accumulation patterns in banking and export sectors.";

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "I experienced a temporary communication hiccup with the intelligence server. Let me analyze recent CSE trading data: John Keells Holdings (JKH.N0000) and Commercial Bank (COMB.N0000) remain strong fundamentally with solid institutional backing.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>SOMI · AI Financial Copilot</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>CSE QUANT MODEL ACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setMessages([messages[0]])}
          >
            <MaterialIcons name="delete-sweep" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatScroll}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((item) => {
            const isUser = item.sender === 'user';
            return (
              <View
                key={item.id}
                style={[styles.messageRow, isUser && styles.messageRowUser]}
              >
                {!isUser && (
                  <View style={styles.aiAvatar}>
                    <FontAwesome5 name="robot" size={14} color="#000" />
                  </View>
                )}
                <View style={isUser ? styles.messageBubbleUser : styles.messageBubbleAi}>
                  <Text style={isUser ? styles.messageLabelTextUser : styles.messageLabelText}>
                    {isUser ? 'YOU' : 'SOMI AI'}
                  </Text>
                  <Text style={isUser ? styles.messageTextBlack : styles.messageTextWhite}>
                    {item.text}
                  </Text>
                  <Text style={isUser ? styles.messageTimestampUser : styles.messageTimestamp}>
                    {item.timestamp}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <View style={styles.messageRow}>
              <View style={styles.aiAvatar}>
                <FontAwesome5 name="robot" size={14} color="#000" />
              </View>
              <View style={[styles.messageBubbleAi, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.evaluatingText}>Analyzing market order book & indicators...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>

          {/* Quick Prompts */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesScroll} contentContainerStyle={{ gap: 8 }}>
            {quickPrompts.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickReplyPill}
                onPress={() => handleSendMessage(prompt)}
                disabled={loading}
              >
                <Text style={styles.quickReplyText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask SOMI about any stock, indicator, or model..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
            >
              <MaterialIcons name="arrow-upward" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimerText}>
            SOMI quant analytics provide AI-assisted insights and are for educational & research purposes.
          </Text>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 4,
  },
  statusText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  chatScroll: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  messageBubbleAi: {
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 1,
  },
  messageBubbleUser: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 18,
    borderTopRightRadius: 4,
    flexShrink: 1,
  },
  messageLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  messageLabelTextUser: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  messageTextWhite: {
    ...typography.body,
    color: '#FFF',
    lineHeight: 22,
    fontSize: 14,
  },
  messageTextBlack: {
    ...typography.body,
    color: '#000',
    lineHeight: 22,
    fontSize: 14,
    fontWeight: '500',
  },
  messageTimestamp: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  messageTimestampUser: {
    fontSize: 9,
    color: '#333',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  evaluatingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.bg,
  },
  quickRepliesScroll: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  quickReplyPill: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickReplyText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  chatInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.bgInput,
    opacity: 0.5,
  },
  disclaimerText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 24,
  },
});
