// MealLogger.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import { supabase } from './supabaseClient';
import { Picker } from '@react-native-picker/picker';

// 헬퍼 함수
export const getFormattedDate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MEAL_TYPES = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
];

const MealLogger = ({ session }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [isSavingCustomFood, setIsSavingCustomFood] = useState(false);
  
  const [mfdsPageNo, setMfdsPageNo] = useState(1);
  const [mfdsHasMore, setMfdsHasMore] = useState(false);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const [selectedFood, setSelectedFood] = useState(null);
  const [servingMultiplier, setServingMultiplier] = useState(1.0);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    setLogs([]); 
    const dateString = getFormattedDate(selectedDate);
    try {
      if (!profile) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('goal_calories, recommend_carbs, recommend_protein, recommend_fat')
          .eq('user_id', session.user.id)
          .single();
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        if (profileData) setProfile(profileData);
      }
      const { data: logsData, error: logsError } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', dateString);
      if (logsError) throw logsError;
      if (logsData) setLogs(logsData);
    } catch (error) {
      Alert.alert('오류', '데이터를 불러오는 데 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeal = async () => {
    if (!foodName || !calories) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수 항목입니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newLog = {
        user_id: session.user.id,
        date: getFormattedDate(selectedDate),
        meal_type: mealType,
        food_name: foodName,
        calories: parseInt(calories) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
      };
      const { data, error } = await supabase.from('meal_logs').insert([newLog]).select();
      if (error) throw error;
      setLogs([...logs, data[0]]);
      setFoodName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    } catch (error) {
      Alert.alert('오류', '식단 기록에 실패했습니다: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeal = async (logId) => {
    try {
      const { error } = await supabase.from('meal_logs').delete().eq('id', logId);
      if (error) throw error;
      setLogs(logs.filter((log) => log.id !== logId));
    } catch (error) {
      Alert.alert('오류', '기록 삭제에 실패했습니다: ' + error.message);
    }
  };

  const handlePrevDay = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setSelectedDate(prevDate);
  };
  const handleNextDay = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setSelectedDate(nextDate);
  };
  const isToday = getFormattedDate(selectedDate) === getFormattedDate(new Date());

  const handleSearchFood = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setMfdsHasMore(false);
      return;
    }
    setIsSearching(true);
    setMfdsPageNo(1);

    const MFDS_API_KEY = 'cd9aec01b84399f9af32a83bd4a8ca8284be3e82202c1bd8c56ea667057325f6'; 
    const baseUrl = `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02`;
    const requestUrl = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=1&numOfRows=20&type=json&FOOD_NM_KR=${encodeURIComponent(query)}`;

    let customData = [];
    let mfdsData = [];

    try {
      try {
        const { data: customResult, error: customError } = await supabase
          .from('user_custom_foods')
          .select('*')
          .eq('user_id', session.user.id)
          .ilike('food_name', `%${query}%`)
          .limit(5);

        if (customError) throw customError; 
        
        customData = (customResult || []).map(item => ({
          ...item,
          maker_name: '나만의 음식'
        }));
        
      } catch (supaError) {
        console.error("--- Supabase 검색 오류 ---", supaError);
      }

      try {
        const mfdsResponse = await axios.get(requestUrl);
        const data = mfdsResponse.data;
        
        if (typeof data === 'string') {
          if (data.includes('SERVICE KEY IS NOT REGISTERED')) {
             Alert.alert("API 키 오류", "등록되지 않은 인증키입니다.");
          }
          setMfdsHasMore(false);
        } else {
            const header = data?.header || data?.response?.header;
            const body = data?.body || data?.response?.body;

            if (header && header.resultCode === '00') {
                let items = [];
                if (body && body.items) {
                    if (Array.isArray(body.items)) {
                        items = body.items;
                    } else if (body.items.item) {
                        items = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
                    } else {
                        items = [body.items];
                    }
                }

                if (items.length > 0) {
                    mfdsData = items.map(item => ({
                        id: `mfds-${item.FOOD_CD || item.foodCd}`,
                        food_name: item.FOOD_NM_KR || item.foodNm,
                        maker_name: item.MAKER_NM || item.mkrNm || '',
                        serving_size: item.SERVING_SIZE || '',
                        calories: parseFloat(item.AMT_NUM1 || item.enerc) || 0,
                        protein: parseFloat(item.AMT_NUM3 || item.prot) || 0,
                        fat: parseFloat(item.AMT_NUM4 || item.fatce) || 0,
                        carbs: parseFloat(item.AMT_NUM6 || item.chocdf) || 0,
                    }));
                    const totalCount = parseInt(body.totalCount) || 0;
                    setMfdsHasMore((1 * 20) < totalCount);
                } else {
                    setMfdsHasMore(false);
                }
            } else {
                setMfdsHasMore(false);
            }
        }
      } catch (apiError) {
        console.error("API 네트워크 오류", apiError.message);
        setMfdsHasMore(false);
      }
      
      const combinedResults = [...customData, ...mfdsData];
      setSearchResults(combinedResults);

    } catch (error) {
      Alert.alert('검색 오류', '데이터를 불러오는 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleLoadMore = async () => {
    if (isSearchingMore || !mfdsHasMore) return;
    setIsSearchingMore(true);

    const nextPage = mfdsPageNo + 1;
    const MFDS_API_KEY = 'cd9aec01b84399f9af32a83bd4a8ca8284be3e82202c1bd8c56ea667057325f6'; 
    const baseUrl = `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02`;
    const requestUrl = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=${nextPage}&numOfRows=20&type=json&FOOD_NM_KR=${encodeURIComponent(searchQuery)}`;

    try {
      const mfdsResponse = await axios.get(requestUrl);
      const data = mfdsResponse.data;
      
      if (typeof data !== 'string') {
        const header = data?.header || data?.response?.header;
        const body = data?.body || data?.response?.body;
        
        if (header && header.resultCode === '00') {
            let items = [];
            if (body && body.items) {
                if (Array.isArray(body.items)) {
                    items = body.items;
                } else if (body.items.item) {
                    items = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
                } else {
                    items = [body.items];
                }
            }

            if (items.length > 0) {
                const newMfdsData = items.map(item => ({
                    id: `mfds-${item.FOOD_CD || item.foodCd}`,
                    food_name: item.FOOD_NM_KR || item.foodNm,
                    maker_name: item.MAKER_NM || item.mkrNm || '',
                    serving_size: item.SERVING_SIZE || '',
                    calories: parseFloat(item.AMT_NUM1 || item.enerc) || 0,
                    protein: parseFloat(item.AMT_NUM3 || item.prot) || 0,
                    fat: parseFloat(item.AMT_NUM4 || item.fatce) || 0,
                    carbs: parseFloat(item.AMT_NUM6 || item.chocdf) || 0,
                }));
                
                setSearchResults(prevResults => [...prevResults, ...newMfdsData]);
                setMfdsPageNo(nextPage);
                const totalCount = parseInt(body.totalCount) || 0;
                setMfdsHasMore((nextPage * 20) < totalCount);
            } else {
                setMfdsHasMore(false);
            }
        }
      }
    } catch (error) {
      setMfdsHasMore(false);
    } finally {
      setIsSearchingMore(false);
    }
  };

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setServingMultiplier(1.0); 
    setModalMode('adjust'); 
  };

  const handleConfirmFood = async () => {
    if (!selectedFood) return;
    setIsSubmitting(true);
    try {
      const multiplier = servingMultiplier;
      const newLog = {
        user_id: session.user.id,
        date: getFormattedDate(selectedDate),
        meal_type: mealType,
        food_name: selectedFood.food_name,
        calories: Math.round(selectedFood.calories * multiplier),
        protein: Math.round(selectedFood.protein * multiplier),
        carbs: Math.round(selectedFood.carbs * multiplier),
        fat: Math.round(selectedFood.fat * multiplier),
      };
      const { data, error } = await supabase.from('meal_logs').insert([newLog]).select();
      if (error) throw error;
      setLogs([...logs, data[0]]);
      setModalVisible(false);
      Alert.alert('저장 완료', `${selectedFood.food_name} (${multiplier}인분)이 추가되었습니다.`);
    } catch (error) {
      Alert.alert('오류', '식단 기록에 실패했습니다: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMultiplier = (amount) => {
    setServingMultiplier(prev => Math.max(0.5, prev + amount));
  };

  const handleSaveCustomFood = async () => {
    if (!customFoodName || !customCalories) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수 항목입니다.');
      return;
    }
    setIsSavingCustomFood(true);
    try {
      const newCustomFood = {
        user_id: session.user.id,
        food_name: customFoodName,
        calories: parseInt(customCalories) || 0,
        protein: parseInt(customProtein) || 0,
        carbs: parseInt(customCarbs) || 0,
        fat: parseInt(customFat) || 0,
      };
      const { data: savedFood, error: saveError } = await supabase
        .from('user_custom_foods')
        .insert([newCustomFood])
        .select()
        .single();
      
      if (saveError) throw saveError;
      await handleSelectFood(savedFood);
      setCustomFoodName(''); setCustomCalories(''); setCustomProtein(''); setCustomCarbs(''); setCustomFat('');
      setModalMode('search'); 
    } catch (error) {
      Alert.alert('저장 오류', error.message);
      setIsSavingCustomFood(false);
    }
  };

  const openAddModal = (type) => {
    setMealType(type);
    setModalMode('search');
    setSearchQuery('');
    setSearchResults([]);
    setModalVisible(true);
  };

  const totalCalories = logs.reduce((sum, log) => sum + (log.calories || 0), 0);
  const totalProtein = logs.reduce((sum, log) => sum + (log.protein || 0), 0);
  const totalCarbs = logs.reduce((sum, log) => sum + (log.carbs || 0), 0);
  const totalFat = logs.reduce((sum, log) => sum + (log.fat || 0), 0);

  const goalCalories = profile?.goal_calories || 1;
  const goalCarbs = profile?.recommend_carbs || 0;
  const goalProtein = profile?.recommend_protein || 0;
  const goalFat = profile?.recommend_fat || 0;

  let progressPercent = (totalCalories / Math.max(goalCalories, 1)) * 100; 
  const progressBarColor = progressPercent > 100 ? '#F44336' : '#007bff';
  progressPercent = Math.min(progressPercent, 100);

  if (loading && !profile) {
    return <ActivityIndicator size="large" style={styles.loading} />;
  }
  
  const renderModalContent = () => {
    if (modalMode === 'add') {
      return (
        <ScrollView>
          <Text style={styles.modalHeader}>새 음식 직접 입력</Text>
          <TextInput style={styles.input} placeholder="음식 이름 (필수)" value={customFoodName} onChangeText={setCustomFoodName} />
          <TextInput style={styles.input} placeholder="칼로리 (필수)" value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="단백질(g)" value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="탄수화물(g)" value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="지방(g)" value={customFat} onChangeText={setCustomFat} keyboardType="numeric" />
          <Button title={isSavingCustomFood ? "저장 중..." : "저장 후 추가"} onPress={handleSaveCustomFood} disabled={isSavingCustomFood} />
          <View style={{ marginTop: 10 }}>
            <Button title="< 취소" onPress={() => setModalMode('search')} color="gray" />
          </View>
        </ScrollView>
      );
    }
    if (modalMode === 'adjust' && selectedFood) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Text style={styles.modalHeader}>{selectedFood.food_name}</Text>
          <Text style={{ textAlign: 'center', color: '#555', marginBottom: 20, fontSize: 16 }}>
            기본: {selectedFood.serving_size || '1인분'}
          </Text>
          <View style={styles.adjustContainer}>
            <TouchableOpacity onPress={() => changeMultiplier(-0.5)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.multiplierText}>{servingMultiplier}x</Text>
            <TouchableOpacity onPress={() => changeMultiplier(0.5)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.adjustedStats}>
            <Text style={styles.statText}>칼로리: {Math.round(selectedFood.calories * servingMultiplier)} kcal</Text>
            <Text style={styles.statText}>탄수화물: {Math.round(selectedFood.carbs * servingMultiplier)} g</Text>
            <Text style={styles.statText}>단백질: {Math.round(selectedFood.protein * servingMultiplier)} g</Text>
            <Text style={styles.statText}>지방: {Math.round(selectedFood.fat * servingMultiplier)} g</Text>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleConfirmFood} disabled={isSubmitting}>
            <Text style={styles.saveButtonText}>{isSubmitting ? "저장 중..." : "식단에 추가하기"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setModalMode('search')}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.modalHeader}>{MEAL_TYPES.find(t=>t.key===mealType)?.label} 메뉴 추가</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="음식 이름 검색 (예: 닭가슴살)"
          value={searchQuery}
          onChangeText={handleSearchFood}
        />
        {searchQuery.length === 0 ? (
          <View style={styles.quickButtonsContainer}>
            <TouchableOpacity style={styles.quickButton} onPress={() => setModalMode('add')}>
              <Text style={styles.quickButtonIcon}>✏️</Text>
              <Text style={styles.quickButtonText}>직접 입력</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickButton} onPress={() => Alert.alert('알림', '즐겨찾기 기능은 준비 중입니다.')}>
              <Text style={styles.quickButtonIcon}>⭐</Text>
              <Text style={styles.quickButtonText}>즐겨찾기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isSearching && <ActivityIndicator />}
            <FlatList
              style={{ flex: 1 }} 
              data={searchResults}
              keyExtractor={(item) => `${item.id}-${item.food_name}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectFood(item)}>
                  <Text style={styles.searchItemName}>
                    {item.food_name}
                    {item.serving_size ? <Text style={styles.searchItemMaker}> ({item.serving_size})</Text> : null}
                    {item.maker_name && item.maker_name !== '나만의 음식' ? <Text style={styles.searchItemMaker}> [{item.maker_name}]</Text> : null}
                  </Text>
                  <Text style={styles.searchItemMacros}>{item.calories} kcal</Text>
                  <Text style={styles.searchItemMacros}>
                    탄수화물: {item.carbs}g | 단백질: {item.protein}g | 지방: {item.fat}g
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearchContainer}>
                  {!isSearching && <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>}
                </View>
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={ isSearchingMore ? <ActivityIndicator size="small" color="#0000ff" /> : null }
            />
          </>
        )}
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>{renderModalContent()}</SafeAreaView>
      </Modal>

      <ScrollView style={styles.container}>
        <View style={styles.summaryContainer}>
          <View style={styles.dateNavigator}>
            <Button title="◀ 이전" onPress={handlePrevDay} />
            <Text style={styles.header}>{getFormattedDate(selectedDate)}</Text>
            <Button title="다음 ▶" onPress={handleNextDay} disabled={isToday} color={isToday ? undefined : "#007bff"} />
          </View>
          <Text style={styles.calorieSummary}>
            {totalCalories} <Text style={styles.calorieGoalText}>/ {goalCalories} kcal</Text>
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: progressBarColor }]} />
          </View>
          <View style={styles.macroSummary}>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>탄수화물</Text>
              <Text style={styles.macroValue}>{totalCarbs} / {goalCarbs}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>단백질</Text>
              <Text style={styles.macroValue}>{totalProtein} / {goalProtein}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>지방</Text>
              <Text style={styles.macroValue}>{totalFat} / {goalFat}g</Text>
            </View>
          </View>
        </View>

        {MEAL_TYPES.map((type) => {
          const mealLogs = logs.filter(log => log.meal_type === type.key);
          const mealCalories = mealLogs.reduce((sum, log) => sum + (log.calories || 0), 0);

          return (
            <View key={type.key} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{type.label}</Text>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                  <Text style={styles.mealTotalCal}>{mealCalories} kcal</Text>
                  <TouchableOpacity style={styles.addButton} onPress={() => openAddModal(type.key)}>
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {mealLogs.length > 0 ? (
                mealLogs.map((item) => (
                  <View key={item.id} style={styles.logItem}>
                    <View style={styles.logInfo}>
                      <Text style={styles.logTextFood}>{item.food_name}</Text>
                      <Text style={styles.logTextMacros}>
                        {/* ⭐️ [수정] C -> P -> F 순서 반영 */}
                        {item.calories}kcal | C:{item.carbs}g P:{item.protein}g F:{item.fat}g
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteMeal(item.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noMealText}>기록된 식단이 없습니다.</Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 15, backgroundColor: '#f8f8f8' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  summaryContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    marginTop: 30,
    // ⭐️ [수정] 중앙 정렬
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dateNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  header: { fontSize: 20, fontWeight: 'bold' },
  calorieSummary: { fontSize: 32, fontWeight: 'bold', color: '#007bff', marginTop: 5, marginBottom: 5 },
  calorieGoalText: { fontSize: 20, color: '#555', fontWeight: 'bold' },
  progressBarContainer: { width: '100%', height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden', marginTop: 5, marginBottom: 15 },
  progressBar: { height: '100%' },
  macroSummary: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, paddingHorizontal: 10 },
  macroItem: { alignItems: 'center' },
  macroLabel: { fontSize: 14, fontWeight: 'bold', color: '#000', marginBottom: 5 },
  macroValue: { fontSize: 14, color: '#555' },

  // 식단 섹션 스타일
  mealSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  mealTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  mealTotalCal: { fontSize: 14, color: '#888', marginRight: 10 },
  addButton: {
    backgroundColor: '#f0f0f0',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { fontSize: 20, color: '#007bff', lineHeight: 22 },
  
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  logInfo: { flex: 1 },
  logTextFood: { fontSize: 16, color: '#333' },
  logTextMacros: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteButton: { padding: 5 },
  deleteText: { fontSize: 16, color: '#ff4444' },
  noMealText: { color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: 10 },

  // 모달 스타일
  modalContainer: { flex: 1, padding: 20, marginTop: 20, backgroundColor: '#fff' },
  modalHeader: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  
  searchInput: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 15 },
  searchItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchItemName: { fontSize: 16, fontWeight: 'bold' },
  searchItemMaker: { fontSize: 14, fontWeight: 'normal', color: '#555' },
  searchItemMacros: { fontSize: 14, color: 'gray', marginTop: 4 },
  emptySearchContainer: { padding: 20, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: 'gray', padding: 20 },
  
  // 버튼 및 조정 UI 스타일
  quickButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    marginTop: 20,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  quickButton: {
    backgroundColor: '#f0f8ff',
    paddingVertical: 20,
    borderRadius: 12,
    width: '48%', 
    height: 90,   
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#007bff',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  quickButtonIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  
  closeButtonContainer: {
    marginTop: 'auto', 
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#e0e0e0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },

  adjustContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 30 },
  adjustBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  adjustBtnText: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  multiplierText: { fontSize: 32, fontWeight: 'bold', marginHorizontal: 20, color: '#007bff' },
  adjustedStats: { backgroundColor: '#f9f9f9', padding: 20, borderRadius: 10, marginBottom: 20, alignItems: 'center' },
  statText: { fontSize: 18, marginBottom: 8, color: '#333' },
  
  saveButton: { backgroundColor: '#007bff', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 15, alignItems: 'center' },
  cancelButtonText: { color: 'gray', fontSize: 16 },

  input: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 10 },
});

export default MealLogger;