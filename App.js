// App.js
import 'react-native-url-polyfill/auto'; // Supabase를 위해 필요
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Supabase 클라이언트
import AuthScreen from './AuthScreen'; // 인증 화면
import NutritionCalculator from './NutritionCalculator'; // 계산기 화면
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 앱 시작 시 현재 로그인 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. 로그인/로그아웃 상태가 변경될 때마다(실시간) 세션 업데이트
    // ⭐️ [수정] 끝에 있던 '_' 오타 제거
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    // 3. 컴포넌트 unmount 시 리스너 정리
    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 4. 세션(로그인 상태)에 따라 다른 화면 렌더링
  return (
    <View style={styles.container}>
      {session && session.user ? (
        // NutritionCalculator에 session 정보를 prop으로 넘겨줌
        <NutritionCalculator key={session.user.id} session={session} />
      ) : (
        <AuthScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});