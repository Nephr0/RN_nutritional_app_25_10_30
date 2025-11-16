// MainTabNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import MealLogger from './MealLogger';
import ProfileScreen from './ProfileScreen';
import StatisticsScreen from './StatisticsScreen'; // ⭐️ [신규] StatisticsScreen import

const Tab = createBottomTabNavigator();

const MainTabNavigator = ({ session }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === '식단 기록') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === '프로필') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === '통계') { // ⭐️ [신규] 통계 탭 아이콘
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff', // 활성 탭 색상
        tabBarInactiveTintColor: 'gray', // 비활성 탭 색상
        headerShown: false, // 각 탭 화면에 헤더 표시 안함
      })}
    >
      <Tab.Screen name="식단 기록" options={{ title: '식단 기록' }}>
        {props => <MealLogger {...props} session={session} />}
      </Tab.Screen>
      <Tab.Screen name="프로필" options={{ title: '프로필' }}>
        {props => <ProfileScreen {...props} session={session} />}
      </Tab.Screen>
      {/* ⭐️ [신규] 통계 탭 추가 */}
      <Tab.Screen name="통계" options={{ title: '통계' }}>
        {props => <StatisticsScreen {...props} session={session} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default MainTabNavigator;