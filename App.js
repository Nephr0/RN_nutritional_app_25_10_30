// App.js

import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MainTabNavigator from './MainTabNavigator';
import EditProfileScreen from './EditProfileScreen';

import { NavigationContainer } from '@react-navigation/native';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        setLoading(false);
        setHasProfile(false);
        setCheckingProfile(true);
      }
    });
  }, []);

  useEffect(() => {
    if (session?.user) {
      checkUserProfile();
    } else if (!loading) {
      setCheckingProfile(false);
    }
  }, [session, loading]);

  const checkUserProfile = async () => {
    try {
      setCheckingProfile(true);
      const { count, error } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      if (error) throw error;

      setHasProfile(count > 0);
    } catch (error) {
      console.error('프로필 확인 실패:', error.message);
      setHasProfile(false);
    } finally {
      setCheckingProfile(false);
    }
  };

  const handleProfileCreated = () => {
    setHasProfile(true);
  };
  
  if (loading || (session && checkingProfile)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* ⭐️ 네비게이션 분기 처리 */}
      {!session ? (
        // 1. 로그인 전
        <Auth />
      ) : !hasProfile ? (
        // 2. 로그인 후 & 프로필 없음 (초기 입력 화면)
        // EditProfileScreen에 필요한 props 전달
        <EditProfileScreen
          session={session}
          isNewUser={true}
          onProfileCreated={handleProfileCreated}
        />
      ) : (
        // 3. 로그인 후 & 프로필 있음 (메인 탭 화면)
        <MainTabNavigator session={session} />
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