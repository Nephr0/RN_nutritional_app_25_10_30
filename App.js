// App.js

import 'react-native-url-polyfill/auto'; // Supabase를 위한 폴리필
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MainTabNavigator from './MainTabNavigator';

// ⭐️ [신규] NavigationContainer import
import { NavigationContainer } from '@react-navigation/native';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        setLoading(false); // 로그아웃 시 로딩 상태 해제
      }
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    // ⭐️ [수정] MainTabNavigator를 NavigationContainer로 감싸기
    <NavigationContainer>
      {session && session.user ? (
        <MainTabNavigator session={session} />
      ) : (
        <Auth />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});