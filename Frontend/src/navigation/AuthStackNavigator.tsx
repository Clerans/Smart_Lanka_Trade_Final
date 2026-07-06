import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
    SplashScreen,
    LoginScreen,
    RegisterScreen,
    OTPVerificationScreen,
    KYCVerificationScreen,
    ForgotPasswordScreen,
    ResetPasswordScreen
} from '../screens';

const Stack = createStackNavigator();

export const AuthStackNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="KYCVerification" component={KYCVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
    );
};
