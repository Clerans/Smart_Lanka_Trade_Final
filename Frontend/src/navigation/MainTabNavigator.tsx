import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/BottomTabBar';
import {
    HomeScreen,
    MarketWatchScreen,
    TradingTerminalScreen,
    WalletOverviewScreen,
    UserProfileScreen
} from '../screens';

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={props => <BottomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                }
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Markets" component={MarketWatchScreen} />
            <Tab.Screen name="Trade" component={TradingTerminalScreen} />
            <Tab.Screen name="Wallet" component={WalletOverviewScreen} />
            <Tab.Screen name="Profile" component={UserProfileScreen} />
        </Tab.Navigator>
    );
};
