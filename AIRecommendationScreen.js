// AIRecommendationScreen.js

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput, // ⭐️ TextInput 추가
} from 'react-native';
import { supabase } from './supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const AIRecommendationScreen = ({ session }) => {
  const [loadingData, setLoadingData] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [todaySummary, setTodaySummary] = useState(null);
  const [goals, setGoals] = useState(null);
  const [aiResult, setAiResult] = useState('');
  
  const [historyList, setHistoryList] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ⭐️ 추가 정보 입력을 위한 상태 변수
  const [preferences, setPreferences] = useState({
    allergies: '',
    liked: '',
    disliked: '',
  });
  // ⭐️ 추가 정보 입력 모달 표시 여부
  const [preferenceModalVisible, setPreferenceModalVisible] = useState(false);


  useFocusEffect(
    useCallback(() => {
      fetchTodayData();
      fetchHistory(); 
    }, [session])
  );

  useEffect(() => {
      fetchHistory();
  }, [session]);

  const getFormattedDate = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}시 ${date.getMinutes()}분`;
  };

  const fetchTodayData = async () => {
    setLoadingData(true);
    try {
      const todayStr = getFormattedDate(new Date());
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('goal_calories, recommend_carbs, recommend_protein, recommend_fat')
        .eq('user_id', session.user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      const userGoals = {
        calories: profileData?.goal_calories || 2000,
        carbs: profileData?.recommend_carbs || 250,
        protein: profileData?.recommend_protein || 100,
        fat: profileData?.recommend_fat || 60,
      };
      setGoals(userGoals);

      const { data: logsData, error: logsError } = await supabase
        .from('meal_logs')
        .select('calories, carbs, protein, fat')
        .eq('user_id', session.user.id)
        .eq('date', todayStr);

      if (logsError) throw logsError;

      const summary = logsData.reduce(
        (acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          carbs: acc.carbs + (log.carbs || 0),
          protein: acc.protein + (log.protein || 0),
          fat: acc.fat + (log.fat || 0),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 }
      );
      setTodaySummary(summary);

    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchHistory = async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistoryList(data || []);
    } catch (error) {
      console.error('기록 로딩 오류:', error);
    }
  };

  const saveRecommendation = async (text) => {
    if (!session?.user?.id) {
        Alert.alert("저장 실패", "로그인 정보가 없어 저장할 수 없습니다.");
        return;
    }

    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .insert([
          { user_id: session.user.id, recommendation_text: text + '\n\n' }
        ]);

      if (error) throw error;
      fetchHistory();
      
    } catch (error) {
      console.error("저장 오류:", error);
      Alert.alert("저장 실패", `결과를 저장하지 못했습니다.\n(에러: ${error.message})`);
    }
  };

  const deleteHistoryItem = async (id) => {
    Alert.alert(
      "기록 삭제",
      "이 추천 기록을 정말 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ai_recommendations')
                .delete()
                .eq('id', id)
                .eq('user_id', session.user.id);

              if (error) throw error;
              fetchHistory(); 
            } catch (error) {
              console.error("삭제 오류:", error.message);
              Alert.alert("삭제 실패", "기록을 삭제하지 못했습니다. 다시 시도해주세요.");
            }
          },
        },
      ]
    );
  };


  const getAIRecommendation = async () => {
    // 모달이 열려있지 않은데 호출되었다면 방어 (혹시 모를 상황)
    if (!preferenceModalVisible && !analyzing) return;

    if (!todaySummary || !goals) {
        Alert.alert("알림", "데이터 로딩 중입니다. 잠시만 기다려주세요.");
        return;
    }
    
    setAnalyzing(true);
    // 분석 시작 시 키보드 내리기
    // Keyboard.dismiss(); 

    try {
      const remaining = {
        calories: Math.max(0, goals.calories - todaySummary.calories),
        carbs: Math.max(0, goals.carbs - todaySummary.carbs),
        protein: Math.max(0, goals.protein - todaySummary.protein),
        fat: Math.max(0, goals.fat - todaySummary.fat),
      };

      // ⭐️ 프롬프트에 사용자 입력 정보 반영
      const prompt = `
        당신은 전문 영양사입니다. 사용자의 오늘 하루 섭취 현황을 분석하고 남은 식사를 추천해주세요.
        
        [기본 정보]
        - 사용자 목표: 칼로리 ${goals.calories}kcal, 탄수화물 ${goals.carbs}g, 단백질 ${goals.protein}g, 지방 ${goals.fat}g
        - 오늘 섭취량: 칼로리 ${todaySummary.calories}kcal, 탄수화물 ${todaySummary.carbs}g, 단백질 ${todaySummary.protein}g, 지방 ${todaySummary.fat}g
        - 부족한 양: 약 칼로리 ${remaining.calories}kcal, 탄수화물 ${remaining.carbs}g, 단백질 ${remaining.protein}g, 지방 ${remaining.fat}g

        [사용자 선호 및 제한사항]
        - 알레르기 정보 (반드시 제외): ${preferences.allergies || '없음'}
        - 선호하는 음식 (가급적 포함): ${preferences.liked || '없음'}
        - 비선호 음식 (제외): ${preferences.disliked || '없음'}

        요청사항:
        1. 현재 상태 분석 코멘트 (짧게)
        2. 위 [사용자 선호 및 제한사항]을 철저히 반영하여 남은 끼니 추천 메뉴 3가지 제안
        3. 각 메뉴별 대략적인 영양 정보
        4. 한국어로 친절하게 답변 (마크다운 없이 텍스트로만)
      `;

      const { data, error } = await supabase.functions.invoke('gemini-ai', {
        body: {
          type: 'recommendation',
          prompt: prompt,
          modelName: "gemini-2.5-flash-lite"
        }
      });

      if (error) throw new Error(error.message);
      if (!data || !data.result) throw new Error("AI로부터 결과가 오지 않았습니다.");

      const text = data.result;

      const cleanText = text.replace(/### |[*]{2}/g, '');
      setAiResult(cleanText);
      
      await saveRecommendation(cleanText);
      
      // ⭐️ 분석 완료 후 모달 닫기 및 입력값 초기화 (선택사항)
      setPreferenceModalVisible(false);
      // setPreferences({ allergies: '', liked: '', disliked: '' }); 

    } catch (error) {
      console.error("AI 분석 오류:", error);
      Alert.alert("오류", "AI 분석에 실패했습니다.\n" + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleHistoryPress = (item) => {
    setSelectedHistory(item);
    setModalVisible(true);
  };

  // 기록 상세 보기 모달
  const renderHistoryModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedHistory ? formatDisplayDate(selectedHistory.created_at) : ''} 결과
          </Text>
          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.resultText}>{selectedHistory?.recommendation_text}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // ⭐️ 추가 정보 입력 모달 렌더링 함수
  const renderPreferenceModal = () => (
    <Modal
      animationType="slide"
      transparent={true} // 배경을 투명하게
      visible={preferenceModalVisible}
      onRequestClose={() => {
        if (!analyzing) setPreferenceModalVisible(false);
      }}
    >
      <View style={styles.prefModalContainer}>
        <View style={styles.prefModalContent}>
          <View style={styles.prefModalHeader}>
            <Text style={styles.prefModalTitle}>맞춤 추천을 위한 정보</Text>
            {!analyzing && (
              <TouchableOpacity onPress={() => setPreferenceModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={styles.prefModalDesc}>
              알레르기나 선호하는 식재료 정보를 입력해주시면 더 정확한 식단을 추천해드립니다. (선택사항)
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>알레르기 정보 (제외할 음식)</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 땅콩, 갑각류, 우유"
                value={preferences.allergies}
                onChangeText={(text) => setPreferences(prev => ({ ...prev, allergies: text }))}
                editable={!analyzing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>좋아하는 음식/식재료</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 닭가슴살, 연어, 샐러드"
                value={preferences.liked}
                onChangeText={(text) => setPreferences(prev => ({ ...prev, liked: text }))}
                editable={!analyzing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>싫어하는 음식/식재료</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 오이, 당근, 고수"
                value={preferences.disliked}
                onChangeText={(text) => setPreferences(prev => ({ ...prev, disliked: text }))}
                editable={!analyzing}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.analyzeButton, { marginBottom: 10, marginTop: 20 }]} // 스타일 재사용
            onPress={getAIRecommendation}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.analyzeButtonText}>AI가 분석 중입니다...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.analyzeButtonText}>분석 시작</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );


  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const percent = (val, goal) => Math.min(Math.round((val / goal) * 100), 100) || 0;

  const renderHeader = () => (
    <View>
      <View style={styles.headerContainer}>
        <Ionicons name="sparkles" size={32} color="#007bff" style={{ marginRight: 10 }} />
        <Text style={styles.headerText}>AI 영양사</Text>
      </View>
      <Text style={styles.subHeaderText}>오늘의 식단을 분석하고 부족한 영양소를 채워보세요.</Text>

      <View style={styles.summaryCard}>
         <Text style={styles.cardTitle}>오늘의 섭취 현황</Text>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>🔥 칼로리</Text>
          <Text style={styles.macroValue}>
            {todaySummary.calories} / {goals.calories} kcal ({percent(todaySummary.calories, goals.calories)}%)
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.macroRowDetail}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>탄수화물</Text>
            <Text style={styles.detailValue}>{todaySummary.carbs}/{goals.carbs}g</Text>
            <Text style={styles.detailPercent}>{percent(todaySummary.carbs, goals.carbs)}%</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>단백질</Text>
            <Text style={styles.detailValue}>{todaySummary.protein}/{goals.protein}g</Text>
            <Text style={styles.detailPercent}>{percent(todaySummary.protein, goals.protein)}%</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>지방</Text>
            <Text style={styles.detailValue}>{todaySummary.fat}/{goals.fat}g</Text>
            <Text style={styles.detailPercent}>{percent(todaySummary.fat, goals.fat)}%</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.analyzeButton}
        // ⭐️ 버튼 클릭 시 추천 함수 호출 대신 입력 모달 열기
        onPress={() => setPreferenceModalVisible(true)}
        disabled={analyzing || loadingData} // 데이터 로딩 중에도 비활성화
      >
          <>
            <Ionicons name="restaurant-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.analyzeButtonText}>AI 식단 추천 받기</Text>
          </>
      </TouchableOpacity>

      {aiResult ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultHeader}>💡 방금 받은 추천 결과</Text>
          <Text style={styles.resultText}>{aiResult}</Text>
        </View>
      ) : null}

      <View style={styles.historyHeaderContainer}>
        <Text style={styles.historyHeader}>📜 지난 추천 기록 ({historyList.length}건)</Text>
      </View>
    </View>
  );

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight : 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { paddingTop: statusBarHeight }]}
      edges={['top']}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      {renderHistoryModal()}
      {/* ⭐️ 추가 정보 입력 모달 렌더링 */}
      {renderPreferenceModal()}
      <FlatList
        style={styles.flatList}
        data={historyList}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContentContainer}
        renderItem={({ item }) => (
          <View style={styles.historyItemContainer}>
            <TouchableOpacity style={styles.historyContent} onPress={() => handleHistoryPress(item)}>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom: 5}}>
                <Ionicons name="time-outline" size={16} color="#666" style={{marginRight: 5}}/>
                <Text style={styles.historyDate}>{formatDisplayDate(item.created_at)}</Text>
              </View>
              <Text style={styles.historyPreview} numberOfLines={1} ellipsizeMode="tail">
                {item.recommendation_text.split('\n')[0] || "내용 없음"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteHistoryItem(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyHistoryText}>아직 기록된 추천 내역이 없습니다.</Text>
            <Text style={{color: '#aaa', marginTop: 5, fontSize: 12}}>AI 추천을 받으면 여기에 기록됩니다.</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 20 }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... (기존 스타일 유지)
  safeArea: { flex: 1, backgroundColor: '#f8f8f8' },
  
  flatList: { flex: 1, backgroundColor: '#f8f8f8' },
  listContentContainer: { padding: 20 }, 
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  headerText: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subHeaderText: { fontSize: 16, color: '#666', marginBottom: 25 },
  
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  macroLabel: { fontSize: 16, fontWeight: '600', color: '#555' },
  macroValue: { fontSize: 16, fontWeight: 'bold', color: '#007bff' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  macroRowDetail: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 5 },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 14, color: '#777', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  detailPercent: { fontSize: 12, color: '#007bff', marginTop: 2 },

  analyzeButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    shadowColor: "#007bff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  analyzeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dceeff',
    marginBottom: 30,
  },
  resultHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  resultText: { fontSize: 16, color: '#444', lineHeight: 24 },

  historyHeaderContainer: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    marginTop: 10,
  },
  historyHeader: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  historyItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  historyContent: {
    flex: 1, 
    padding: 15,
  },
  deleteButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  historyDate: { fontSize: 14, color: '#666', fontWeight: '600' },
  historyPreview: { fontSize: 14, color: '#888', marginTop: 5 },
  emptyHistoryText: { textAlign: 'center', color: '#aaa', marginTop: 10, fontStyle: 'italic', fontSize: 16 },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButton: { padding: 5 },
  modalContent: { padding: 20 },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ⭐️ 추가 정보 입력 모달 스타일
  prefModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // 반투명 배경
  },
  prefModalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  prefModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  prefModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  prefModalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  input: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
});

export default AIRecommendationScreen;