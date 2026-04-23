import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, layout } from '../theme';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    return (
        <View style={styles.container}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                // Determine icon based on route name
                let iconName: keyof typeof MaterialIcons.glyphMap = 'help-outline';
                if (route.name === 'Home') iconName = 'home';
                if (route.name === 'Markets') iconName = 'trending-up';
                if (route.name === 'Trade') iconName = 'swap-horiz';
                if (route.name === 'Wallet') iconName = 'account-balance-wallet';
                if (route.name === 'Profile') iconName = 'person-outline';

                const isTrade = route.name === 'Trade';

                return (
                    <TouchableOpacity
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        testID={(options as any).tabBarTestID}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        style={styles.tabItem}
                    >
                        {isTrade ? (
                            <View style={[styles.tradeButton, isFocused && styles.tradeButtonActive]}>
                                <MaterialIcons name={iconName} size={28} color="#000000" />
                            </View>
                        ) : (
                            <MaterialIcons
                                name={iconName}
                                size={24}
                                color={isFocused ? colors.accent : colors.textSecondary}
                            />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.bg,
        height: 70,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: 10,
        paddingTop: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tradeButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    tradeButtonActive: {
        backgroundColor: colors.accentDark,
    },
});
