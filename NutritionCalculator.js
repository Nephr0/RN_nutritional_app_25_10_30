// NutritionCalculator.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from './supabaseClient';

const NutritionCalculator = ({ session, onProfileCreated }) => {
  const [height, setHeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [activityLevel, setActivityLevel] = useState(1.2);
  const [bmr, setBmr] = useState(null);
  const [tdee, setTdee] = useState(null);
  const [goalCalories, setGoalCalories] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveUserDataToSupabase = async (userData) => {
    setIsLoading(true);
    try {
      const dataToSave = {
        ...userData,
        user_id: session.user.id,
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert([dataToSave]);

      if (error) throw error;

      console.log('Supabase 저장 성공:', data);
      alert('프로필이 성공적으로 저장되었습니다!');
      
    } catch (error) {
      console.error('Supabase 저장 중 오류:', error.message);
      alert(`저장에 실패했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGoalCalories = () => {
    const h = parseFloat(height);
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const a = parseInt(age);

    if (!h || !cw || !gw || !a) {
      alert('모든 항목을 올바르게 입력해주세요.');
      return;
    }

    let calculatedBmr = 0;
    if (gender === 'male') {
      calculatedBmr = (10 * cw) + (6.25 * h) - (5 * a) + 5;
    } else {
      calculatedBmr = (10 * cw) + (6.25 * h) - (5 * a) - 161;
    }
    const calculatedTdee = calculatedBmr * activityLevel;
    let calculatedGoalCalories = calculatedTdee;
    const CALORIE_ADJUSTMENT = 500;
    if (gw < cw) {
      calculatedGoalCalories = calculatedTdee - CALORIE_ADJUSTMENT;
    } else if (gw > cw) {
      calculatedGoalCalories = calculatedTdee + CALORIE_ADJUSTMENT;
    }

    const userData = {
      gender: gender,
      age: a,
      height: h,
      current_weight: cw,
      goal_weight: gw,
      activity_level: activityLevel,
      bmr: calculatedBmr,
      tdee: calculatedTdee,
      goal_calories: calculatedGoalCalories,
    };

    setBmr(calculatedBmr.toFixed(2));
    setTdee(calculatedTdee.toFixed(2));
    setGoalCalories(calculatedGoalCalories.toFixed(2));

    saveUserDataToSupabase(userData);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 1. 성별 */}
      <View style={styles.row}>
        <Text style={styles.label}>성별</Text>
        <View style={[styles.pickerContainer, styles.inputWrapper]}>
          <Picker
            selectedValue={gender}
            onValueChange={(itemValue) => setGender(itemValue)}
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
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
      </View>
      {/* 3. 키 */}
      <View style={styles.row}>
        <Text style={styles.label}>키 (cm)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
      </View>
      {/* 4. 현재 체중 */}
      <View style={styles.row}>
        <Text style={styles.label}>현재 체중 (kg)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={currentWeight}
          onChangeText={setCurrentWeight}
          keyboardType="numeric"
        />
      </View>
      {/* 5. 목표 체중 */}
      <View style={styles.row}>
        <Text style={styles.label}>목표 체중 (kg)</Text>
        <TextInput
          style={[styles.input, styles.inputWrapper]}
          value={goalWeight}
          onChangeText={setGoalWeight}
          keyboardType="numeric"
        />
      </View>
      {/* 6. 활동량 */}
      <View style={styles.row}>
        <Text style={styles.label}>활동량</Text>
        <View style={[styles.pickerContainer, styles.inputWrapper]}>
          <Picker
            selectedValue={activityLevel}
            onValueChange={(itemValue) => setActivityLevel(itemValue)}
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
        title={isLoading ? '저장 중...' : '프로필 계산 및 저장'}
        onPress={calculateGoalCalories}
        disabled={isLoading}
      />

      {/* 결과 표시 및 '확인 버튼' */}
      {bmr && tdee && goalCalories && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>기초 대사량 (BMR)</Text>
          <Text style={styles.subResultValue}>{bmr} kcal</Text>
          <Text style={styles.resultText}>현재 체중 유지 (TDEE)</Text>
          <Text style={styles.subResultValue}>{tdee} kcal</Text>
          <View style={styles.separator} />
          <Text style={styles.resultText}>일일 권장 섭취량</Text>
          <Text style={styles.mainResultValue}>{goalCalories} kcal</Text>
          <Text style={styles.resultDescription}>
            (안전한 감량/증량을 위해 500kcal를 조절한 값입니다.)
          </Text>

          {/* 확인 버튼 (오류 없음) */}
          <View style={styles.confirmButton}>
            <Button
              title="확인하고 다음으로"
              onPress={onProfileCreated} 
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// 스타일 시트
const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  inputWrapper: {
    flex: 1.5,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: '#fff',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
  },
  resultContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginTop: 10,
  },
  subResultValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#555',
    marginVertical: 4,
  },
  mainResultValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007bff',
    marginVertical: 10,
  },
  resultDescription: {
    fontSize: 14,
    color: 'gray',
    textAlign: 'center',
    marginTop: 10,
  },
  separator: {
    height: 1,
    width: '80%',
    backgroundColor: '#cccccc',
    marginVertical: 15,
  },
  confirmButton: {
    marginTop: 20,
    width: '80%',
  },
});

export default NutritionCalculator;