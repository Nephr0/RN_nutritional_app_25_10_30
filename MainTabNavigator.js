// MainTabNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
// ⭐️ [수정] MealLogger를 import 합니다.
import MealLogger from './MealLogger';
import ProfileScreen from './ProfileScreen';
// ⭐️ [수정] 임시용 Text, View, StyleSheet를 제거합니다.

const Tab = createBottomTabNavigator();

// ⭐️ [수정] 임시 화면(PlaceholderScreen1)을 삭제합니다.

const MainTabNavigator = ({ session }) => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#007bff',
        }}
      >
        {/* 1. ⭐️ [수정] 식단 기록 탭 (실제 화면 연결) */}
        <Tab.Screen 
          name="Logger" 
          options={{ title: '식단 기록' }}
        >
          {/* props를 전달하기 위해 함수 방식 사용 */}
          {(props) => <MealLogger {...props} session={session} />}
        </Tab.Screen>

        {/* 2. 프로필 탭 (수정 없음) */}
        <Tab.Screen 
          name="Profile" 
          options={{ title: '프로필' }}
        >
          {(props) => <ProfileScreen {...props} session={session} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
};

// ⭐️ [수정] 임시용 styles를 삭제합니다.

export default MainTabNavigator;