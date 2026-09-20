import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { aiService } from '../../services/apiService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

const QUICK_PROMPTS = [
  '📊 What do you think about BTC?',
  '📈 Is now a good time to buy ETH?',
  '⚡ Give me analysis on SOL',
  '💼 Analyze my portfolio',
  '🎯 What is the current market trend?'
];

export const SOMIAIChatScreen = () => {
  const navigation = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I'm SOMI, your SmartLanka Trade AI assistant. I can analyze real-time market indicators, moving averages, and technical momentum for you. Ask me about any cryptocurrency!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);
    scrollToBottom();

    try {
      const response = await aiService.chatWithSOMI(text);
      const aiReply = response?.data?.reply || "I've analyzed the market data. Please verify technical indicators in the AI Insights screen.";

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "I'm having trouble connecting to the live market recommendation engine right now. Please check your network or try again.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      scrollToBottom();
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
            <Text style={styles.headerTitle}>SOMI - AI Trading Assistant</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>ENGINE ACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AIAnalytics')}>
            <MaterialIcons name="insights" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatScroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <View
                key={msg.id}
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
                    {msg.text}
                  </Text>
                  <Text style={isUser ? styles.messageTimestampUser : styles.messageTimestamp}>
                    {msg.time}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={styles.messageRow}>
              <View style={styles.aiAvatar}>
                <FontAwesome5 name="robot" size={14} color="#000" />
              </View>
              <View style={[styles.messageBubbleAi, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={styles.typingText}>SOMI is analyzing indicators...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>

          {/* Quick Prompts */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesScroll}>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickReplyPill}
                onPress={() => handleSend(prompt)}
              >
                <Text style={styles.quickReplyText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Text Input Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask SOMI about BTC, ETH, SOL..."
              placeholderTextColor={colors.textSecondary}
              value={inputMessage}
              onChangeText={setInputMessage}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputMessage.trim() && { opacity: 0.6 }]}
              onPress={() => handleSend()}
              disabled={!inputMessage.trim() || isTyping}
            >
              <MaterialIcons name="arrow-upward" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimerText}>
            Demo & Research AI Engine. Not financial advice.
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
    paddingTop: 16,
    paddingBottom: 16,
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
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
    fontSize: 9,
    fontWeight: '700',
  },
  chatScroll: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 18,
    maxWidth: '88%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  messageBubbleAi: {
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageBubbleUser: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageLabelText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageLabelTextUser: {
    ...typography.label,
    color: '#00000080',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageTextWhite: {
    ...typography.body,
    color: '#FFF',
    lineHeight: 20,
    fontSize: 13,
  },
  messageTextBlack: {
    ...typography.body,
    color: '#000',
    lineHeight: 20,
    fontSize: 13,
  },
  messageTimestamp: {
    ...typography.bodySmall,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  messageTimestampUser: {
    ...typography.bodySmall,
    fontSize: 9,
    color: '#00000099',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  typingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickRepliesScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  quickReplyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    marginRight: 8,
  },
  quickReplyText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    paddingLeft: 14,
    paddingRight: 6,
    height: 48,
    marginBottom: 8,
  },
  chatInput: {
    ...typography.body,
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disclaimerText: {
    ...typography.label,
    fontSize: 9,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
