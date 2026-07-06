import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { alertService } from './apiService';

export const registerForPushNotificationsAsync = async () => {

  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    console.log('ℹ️ Skipping push notification registration in Expo Go.');
    return null;
  }

  
  if (!Device.isDevice) {
    console.warn('ℹ️ Push notifications require a physical device.');
    return null;
  }

  try {
  
    const Notifications = require('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }
    
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);

   
    if (token) {
      await alertService.savePushToken(token);
      console.log('Push token saved to backend');
    }
    
    return token;
  } catch (error) {
    console.error('Error in push notification setup:', error);
    return null;
  }
};
