import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from './supabaseClient'; // 기존 Supabase 클라이언트

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 회원가입 함수
  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('회원가입 오류', error.message);
    } else {
      Alert.alert('회원가입 성공', '이메일을 확인하여 인증을 완료해주세요.');
    }
    setLoading(false);
  };

  // 로그인 함수
  const handleSignIn = async () => {
    setLoading(true);
    // ⭐️ [수정] 끝에 있던 '_' 오타 제거
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('로그인 오류', error.message);
    // 로그인이 성공하면, App.js의 onAuthStateChange 리스너가
    // 자동으로 감지하여 메인 화면(NutritionCalculator)으로 전환합니다.
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>영양 관리 앱</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        secureTextEntry
      />
      <Button
        title={loading ? '처리 중...' : '로그인'}
        onPress={handleSignIn}
        disabled={loading}
      />
      <Button
        title={loading ? '처리 중...' : '회원가입'}
        onPress={handleSignUp}
        disabled={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
});

export default AuthScreen;