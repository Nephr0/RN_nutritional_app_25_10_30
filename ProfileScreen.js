// ProfileScreen.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from './supabaseClient';

// NutritionCalculator의 계산 로직을 가져와서
// 프로필 수정 시 BMR, TDEE, 목표 칼로리를 다시 계산합니다.
const calculateDerivedValues = (profile) => {
  const { current_weight: w, height: h, age: a, gender, activity_level, goal_weight: gw } = profile;
  if (!w || !h || !a || !gender || !activity_level || !gw) {
    return profile; // 필수 값이 없으면 계산 중지
  }

  let bmr = 0;
  if (gender === 'male') {
    bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
  } else {
    bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
  }

  const tdee = bmr * activity_level;
  let goalCalories = tdee;
  const CALORIE_ADJUSTMENT = 500;
  if (gw < w) {
    goalCalories = tdee - CALORIE_ADJUSTMENT;
  } else if (gw > w) {
    goalCalories = tdee + CALORIE_ADJUSTMENT;
  }

  return {
    ...profile,
    bmr: bmr,
    tdee: tdee,
    goal_calories: goalCalories,
  };
};


const ProfileScreen = ({ session }) => {
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 폼 데이터를 담을 State
  const [profileData, setProfileData] = useState({
    gender: 'male',
    age: '',
    height: '',
    current_weight: '',
    goal_weight: '',
    activity_level: 1.2,
  });

  // 1. 화면 로드 시, DB에서 기존 프로필 정보를 불러옵니다.
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*') // 모든 정보
          .eq('user_id', session.user.id)
          .single(); // 1개만

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          // DB에서 가져온 데이터로 State를 채웁니다.
          setProfileData({
            gender: data.gender || 'male',
            age: data.age?.toString() || '',
            height: data.height?.toString() || '',
            current_weight: data.current_weight?.toString() || '',
            goal_weight: data.goal_weight?.toString() || '',
            activity_level: data.activity_level || 1.2,
          });
        }
      } catch (error) {
        Alert.alert('오류', '프로필을 불러오지 못했습니다: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [session.user.id]); // session.user.id가 변경될 때 다시 불러오기

  // 2. '저장' 버튼 클릭 시, 데이터를 'UPDATE'합니다.
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      // 1. State의 문자열을 숫자로 변환
      let dataToSave = {
        ...profileData,
        age: parseInt(profileData.age) || 0,
        height: parseFloat(profileData.height) || 0,
        current_weight: parseFloat(profileData.current_weight) || 0,
        goal_weight: parseFloat(profileData.goal_weight) || 0,
      };

      // 2. BMR, TDEE, 목표 칼로리 재계산
      dataToSave = calculateDerivedValues(dataToSave);
      
      // 3. DB에 업데이트
      const { error } = await supabase
        .from('user_profiles')
        .update(dataToSave) // INSERT가 아닌 UPDATE
        .eq('user_id', session.user.id); // 내 ID에 해당하는 데이터만

      if (error) throw error;
      
      Alert.alert('성공', '프로필이 업데이트되었습니다.');
    } catch (error) {
      Alert.alert('오류', '프로필 업데이트에 실패했습니다: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. 폼 State 업데이트 헬퍼 함수
  const setFormValue = (key, value) => {
    setProfileData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loading} />;
  }

  // 4. 렌더링
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>프로필 수정</Text>
      <Text style={styles.emailText}>{session.user.email}</Text>
      
      {/* 1. 성별 */}
      <View style={styles.row}>
        <Text style={styles.label}>성별</Text>
        <View style={[styles.pickerContainer, styles.inputWrapper]}>
          <Picker
            selectedValue={profileData.gender}
            onValueChange={(value) => setFormValue('gender', value)}
            style={styles.picker}
          >
            <Picker.Item label="남성" value="male" />
            <Picker.Item label="여성" value="female" />
          </Picker>
        </View>
      </View>
      {/* 2. 나이 */}
      <View style={styles.row}>
        <Text style={styles.label}>나이 (세)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={profileData.age}
          onChangeText={(value) => setFormValue('age', value)}
          keyboardType="numeric"
        />
      </View>
      {/* 3. 키 */}
      <View style={styles.row}>
        <Text style={styles.label}>키 (cm)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={profileData.height}
          onChangeText={(value) => setFormValue('height', value)}
          keyboardType="numeric"
        />
      </View>
      {/* 4. 현재 체중 */}
      <View style={styles.row}>
        <Text style={styles.label}>현재 체중 (kg)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={profileData.current_weight}
          onChangeText={(value) => setFormValue('current_weight', value)}
          keyboardType="numeric"
        />
      </View>
      {/* 5. 목표 체중 */}
      <View style={styles.row}>
        <Text style={styles.label}>목표 체중 (kg)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={profileData.goal_weight}
          onChangeText={(value) => setFormValue('goal_weight', value)}
          keyboardType="numeric"
        />
      </View>
      {/* 6. 활동량 */}
      <View style={styles.row}>
        <Text style={styles.label}>활동량</Text>
        <View style={[styles.pickerContainer, styles.inputWrapper]}>
          <Picker
            selectedValue={profileData.activity_level}
            onValueChange={(value) => setFormValue('activity_level', value)}
            style={styles.picker}
          >
            <Picker.Item label="좌식" value={1.2} />
            <Picker.Item label="가벼운 활동" value={1.375} />
            <Picker.Item label="중간 활동" value={1.55} />
            <Picker.Item label="높은 활동" value={1.725} />
            <Picker.Item label="매우 높은 활동" value={1.9} />
          </Picker>
        </View>
      </View>

      <Button
        title={isUpdating ? '저장 중...' : '프로필 저장하기'}
        onPress={handleUpdateProfile}
        disabled={isUpdating}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  emailText: { fontSize: 16, color: 'gray', textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  label: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  inputWrapper: { flex: 1.5 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#fff' },
  pickerContainer: { borderColor: 'gray', borderWidth: 1, borderRadius: 5, backgroundColor: '#fff', height: 50, justifyContent: 'center' },
  picker: { width: '100%' },
});

export default ProfileScreen;