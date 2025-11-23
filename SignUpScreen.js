// SignUpScreen.js

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  StyleSheet, 
  Alert, 
  TouchableOpacity,
  ActivityIndicator // 로딩 표시를 위해 추가
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './supabaseClient';

const SignUpScreen = ({ onGoBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  // ⭐️  이메일 중복 확인 진행 중 상태
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  // ⭐️ 이메일 사용 가능 여부 확인 상태
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // ⭐️ 이메일 중복 확인 함수
  const handleCheckDuplicate = async () => {
    if (!email.trim()) {
      Alert.alert('알림', '이메일을 입력해주세요.');
      return;
    }

    // 간단한 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
       Alert.alert('오류', '올바른 이메일 형식이 아닙니다.'); 
       return; 
    }

    setCheckingDuplicate(true);
    try {
      // ⭐️ 1단계에서 만든 Supabase RPC 함수 호출
      const { data, error } = await supabase.rpc('check_email_exists', { 
        email_to_check: email.trim() 
      });

      if (error) throw error;

      if (data === true) {
        // data가 true면 이미 존재하는 이메일
        Alert.alert('알림', '이미 가입된 이메일입니다. 다른 이메일을 사용해주세요.');
        setIsEmailVerified(false);
      } else {
        // data가 false면 사용 가능한 이메일
        Alert.alert('알림', '사용 가능한 이메일입니다.');
        setIsEmailVerified(true);
      }

    } catch (error) {
      console.error('중복 확인 오류:', error);
      Alert.alert('오류', '중복 확인 중 문제가 발생했습니다.');
      setIsEmailVerified(false);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }

    // ⭐️ 중복 확인 여부 검사
    if (!isEmailVerified) {
      Alert.alert('알림', '이메일 중복 확인을 먼저 진행해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('비밀번호 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          throw new Error('이미 가입된 이메일 주소입니다.');
        }
        throw error; 
      }

      Alert.alert(
        '회원가입 성공', 
        '이메일 인증을 확인해주세요. (로그인 페이지로 이동합니다)',
        [{ text: '확인', onPress: () => onGoBack() }]
      );
    } catch (error) {
      Alert.alert('회원가입 오류', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.header}>회원가입</Text>
        
        <Text style={styles.label}>이메일</Text>
        {/* ⭐️  이메일 입력창과 버튼을 가로로 배치하기 위한 컨테이너 */}
        <View style={styles.emailRowContainer}>
          <TextInput
            style={[styles.input, styles.emailInput]} // 스타일 합침
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              // ⭐️ 이메일이 바뀌면 인증 상태 초기화
              if (isEmailVerified) setIsEmailVerified(false);
            }}
            placeholder="example@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {/* ⭐️ 중복 확인 버튼 */}
          <TouchableOpacity 
            style={[styles.checkButton, isEmailVerified && styles.checkButtonVerified]} 
            onPress={handleCheckDuplicate}
            disabled={checkingDuplicate || !email.trim()}
          >
            {checkingDuplicate ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkButtonText}>
                {isEmailVerified ? '확인 완료' : '중복 확인'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {/* ⭐️ 인증 상태 안내 메시지 */}
        {isEmailVerified && <Text style={styles.verifiedText}>✓ 사용 가능한 이메일입니다.</Text>}


        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="6자 이상 입력"
          secureTextEntry
        />

        <Text style={styles.label}>비밀번호 확인</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="비밀번호 다시 입력"
          secureTextEntry
        />

        <View style={styles.buttonContainer}>
          {/* ⭐️ 인증되지 않았으면 버튼 비활성화 스타일 적용 */}
          <Button
            title={loading ? '가입 중...' : '회원가입 완료'}
            onPress={handleSignUp}
            disabled={loading || !isEmailVerified}
            color={!isEmailVerified ? "gray" : "#007bff"} // 인증 전에는 회색
          />
        </View>

        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 로그인 화면으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#555',
  },
  emailRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5, 
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fafafa',
    fontSize: 16,
    color: '#000000', 
  },
  emailInput: {
    flex: 1,
    marginRight: 10, 
    marginBottom: 0, 
  },
  checkButton: {
    height: 50,
    backgroundColor: '#6c757d', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 8,
    minWidth: 80,
  },
  checkButtonVerified: {
    backgroundColor: '#28a745', 
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  verifiedText: {
    color: '#28a745',
    fontSize: 14,
    marginBottom: 15,
    marginLeft: 5,
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  backButton: {
    alignItems: 'center',
    padding: 10,
  },
  backButtonText: {
    color: '#007bff',
    fontSize: 16,
  },
});

export default SignUpScreen;