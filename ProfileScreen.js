// ProfileScreen.js

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from './supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ProfileScreen = ({ session, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getProfile();
    }, [])
  );

  const getProfile = async () => {
    try {
      setLoading(true);
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      Alert.alert('오류', '프로필을 불러오는 데 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
  Alert.alert(
    '로그아웃',
    '정말로 로그아웃 하시겠습니까?',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {

            // 1. Supabase 로그아웃 요청
            const { error } = await supabase.auth.signOut();
            
            // 2. 에러가 있다면 예외 발생시키기
            if (error) throw error;

          } catch (error) {
            console.error("로그아웃 실패:", error.message);
            Alert.alert("로그아웃 실패", "네트워크 상태를 확인해주세요.\n에러: " + error.message);
          } finally {
          }
        },
      },
    ]
  );
};

  const getActivityLevelText = (level) => {
    const levelNum = parseFloat(level);
    if (levelNum === 1.2) return '매우 적음';
    if (levelNum === 1.375) return '적음';
    if (levelNum === 1.55) return '보통';
    if (levelNum === 1.725) return '많음';
    if (levelNum === 1.9) return '매우 많음';
    return level;
  };

  const getGoalText = (type) => {
    switch (type) {
      case 'diet': return '다이어트';
      case 'bulkup': return '벌크업';
      case 'maintain': return '체중 유지';
      default: return '미설정';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.header}>내 프로필</Text>

        <View style={styles.infoCard}>
          <View style={styles.row}>
            <Text style={styles.label}>아이디</Text>
            <Text style={styles.value}>{session.user.email}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.label}>목적</Text>
            <Text style={[styles.value, { color: '#007bff' }]}>{getGoalText(profile?.goal_type)}</Text>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>성별</Text>
            <Text style={styles.value}>{profile?.gender === 'male' ? '남성' : '여성'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>나이</Text>
            <Text style={styles.value}>{profile?.age}세</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>키</Text>
            <Text style={styles.value}>{profile?.height} cm</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>현재 체중</Text>
            <Text style={styles.value}>{profile?.current_weight} kg</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>목표 체중</Text>
            <Text style={styles.value}>{profile?.goal_weight} kg</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>활동량</Text>
            <Text style={styles.value}>{getActivityLevelText(profile?.activity_level)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.macroContainer}>
            <Text style={styles.macroTitle}>일일 권장 섭취량</Text>
            
            <View style={styles.row}>
              <Text style={styles.highlightLabel}>목표 칼로리</Text>
              <Text style={styles.highlightValue}>{profile?.goal_calories} kcal</Text>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>탄수화물</Text>
                <Text style={styles.macroValue}>{profile?.recommend_carbs || 0}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>단백질</Text>
                <Text style={styles.macroValue}>{profile?.recommend_protein || 0}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>지방</Text>
                <Text style={styles.macroValue}>{profile?.recommend_fat || 0}g</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('프로필 수정', { profileData: profile })}
        >
          <Text style={styles.buttonText}>프로필 수정하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleSignOut}
        >
          <Text style={styles.buttonText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    marginTop: -10,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    flexShrink: 1,
    textAlign: 'right',
  },
  highlightLabel: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  highlightValue: {
    fontSize: 18,
    color: '#007bff',
    fontWeight: 'bold',
  },
  macroContainer: {
    marginBottom: 15,
  },
  macroTitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 15, 
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15, 
  },
  macroItem: {
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 14,
    color: '#555',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  button: {
    width: '100%',
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButton: {
    backgroundColor: '#FF5252',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;