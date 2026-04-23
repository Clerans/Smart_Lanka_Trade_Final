import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthStackNavigator } from './AuthStackNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { colors } from '../theme';
import {
    AssetDetailsScreen,
    AIAnalyticsScreen,
    SOMIAIChatScreen,
    DemoTradingScreen,
    CurrencyConversionScreen,
    SecuritySettingsScreen
} from '../screens';

const Stack = createStackNavigator();

const NavigationTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
    },
};

export const RootNavigator = () => {
    return (
        <NavigationContainer theme={NavigationTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Auth" component={AuthStackNavigator} />
                <Stack.Screen name="MainApp" component={MainTabNavigator} />

                <Stack.Screen name="AssetDetails" component={AssetDetailsScreen} />
                <Stack.Screen name="AIAnalytics" component={AIAnalyticsScreen} />
                <Stack.Screen name="SOMIAIChat" component={SOMIAIChatScreen} />
                <Stack.Screen name="DemoTrading" component={DemoTradingScreen} />
                <Stack.Screen name="CurrencyConversion" component={CurrencyConversionScreen} />
                <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
