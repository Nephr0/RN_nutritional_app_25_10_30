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
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
  
  const [customFoodId, setCustomFoodId] = useState(null);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [isSavingCustomFood, setIsSavingCustomFood] = useState(false);
  const [myFoodsList, setMyFoodsList] = useState([]); 
  
  const [mfdsPageNo, setMfdsPageNo] = useState(1);
  const [mfdsHasMore, setMfdsHasMore] = useState(false);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const [selectedFood, setSelectedFood] = useState(null);
  const [servingMultiplier, setServingMultiplier] = useState(1.0);
  const [favoritesList, setFavoritesList] = useState([]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

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

  const handleAddMeal = async () => { /* ... */ };
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

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      if (response.data.status === 1) {
        const product = response.data.product;
        const nutriments = product.nutriments;
        const foodData = {
          food_name: product.product_name || '스캔된 음식',
          calories: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0,
          carbs: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
          protein: nutriments.proteins_100g || nutriments.proteins || 0,
          fat: nutriments.fat_100g || nutriments.fat || 0,
          serving_size: product.serving_size || '100g',
          maker_name: product.brands || '바코드 스캔',
        };
        handleSelectFood(foodData); 
      } else {
        Alert.alert("검색 실패", "해당 바코드의 식품 정보를 찾을 수 없습니다. 직접 입력해주세요.", [
            { text: '직접 입력하기', onPress: () => setModalMode('direct_input') },
            { text: '다시 스캔', onPress: () => setScanned(false) }
        ]);
      }
    } catch (error) {
      Alert.alert("오류", "바코드 정보를 가져오는 데 실패했습니다.");
      setScanned(false);
    }
  };

  const openBarcodeScanner = async () => {
    if (!permission) return;
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("권한 필요", "카메라 권한이 필요합니다.");
        return;
      }
    }
    setScanned(false);
    setModalMode('barcode');
  };

  const parseMfdsResponse = (data) => {
    if (typeof data === 'string') return [];
    const header = data?.header || data?.response?.header;
    const body = data?.body || data?.response?.body;
    if (header && header.resultCode === '00' && body && body.items) {
      const itemsSource = Array.isArray(body.items) ? body.items : (body.items.item ? (Array.isArray(body.items.item) ? body.items.item : [body.items.item]) : [body.items]);
      return [].concat(itemsSource).filter(i => i);
    }
    return [];
  };

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
    const urlFoodName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=1&numOfRows=20&type=json&FOOD_NM_KR=${encodeURIComponent(query)}`;
    const urlMakerName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=1&numOfRows=20&type=json&MAKER_NM=${encodeURIComponent(query)}`;

    let customData = [];
    let mfdsItems = [];

    try {
      try {
        const { data: customResult, error: customError } = await supabase
          .from('user_custom_foods')
          .select('*')
          .eq('user_id', session.user.id)
          .or(`food_name.ilike.%${query}%,maker_name.ilike.%${query}%`) 
          .limit(5);
        if (customError) throw customError; 
        customData = (customResult || []).map(item => ({ ...item, maker_name: '나만의 음식' }));
      } catch (supaError) { console.error("Supabase 검색 오류", supaError); }

      try {
        const [resFood, resMaker] = await Promise.all([
          axios.get(urlFoodName).catch(() => ({ data: null })),
          axios.get(urlMakerName).catch(() => ({ data: null }))
        ]);

        const itemsFood = parseMfdsResponse(resFood.data);
        const itemsMaker = parseMfdsResponse(resMaker.data);
        const mergedItems = [...itemsFood, ...itemsMaker];
        const uniqueItems = [];
        const seenIds = new Set();

        mergedItems.forEach(item => {
          const id = item.FOOD_CD || item.foodCd;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            uniqueItems.push(item);
          }
        });

        mfdsItems = uniqueItems.map(item => ({
          id: `mfds-${item.FOOD_CD || item.foodCd}`,
          food_name: item.FOOD_NM_KR || item.foodNm,
          maker_name: item.MAKER_NM || item.mkrNm || '',
          serving_size: item.SERVING_SIZE || '',
          calories: parseFloat(item.AMT_NUM1 || item.enerc) || 0,
          protein: parseFloat(item.AMT_NUM3 || item.prot) || 0,
          fat: parseFloat(item.AMT_NUM4 || item.fatce) || 0,
          carbs: parseFloat(item.AMT_NUM6 || item.chocdf) || 0,
        }));

        const totalCount1 = parseInt(resFood.data?.body?.totalCount || resFood.data?.response?.body?.totalCount || 0);
        const totalCount2 = parseInt(resMaker.data?.body?.totalCount || resMaker.data?.response?.body?.totalCount || 0);
        setMfdsHasMore((1 * 20) < Math.max(totalCount1, totalCount2));

      } catch (apiError) {
        console.error("API 네트워크 오류", apiError.message);
        setMfdsHasMore(false);
      }
      
      const combinedResults = [...customData, ...mfdsItems];
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
    const urlFoodName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=${nextPage}&numOfRows=20&type=json&FOOD_NM_KR=${encodeURIComponent(searchQuery)}`;
    const urlMakerName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=${nextPage}&numOfRows=20&type=json&MAKER_NM=${encodeURIComponent(searchQuery)}`;

    try {
      const [resFood, resMaker] = await Promise.all([
        axios.get(urlFoodName).catch(() => ({ data: null })),
        axios.get(urlMakerName).catch(() => ({ data: null }))
      ]);
      
      const itemsFood = parseMfdsResponse(resFood.data);
      const itemsMaker = parseMfdsResponse(resMaker.data);
      const mergedItems = [...itemsFood, ...itemsMaker];
      const uniqueItems = [];
      const seenIds = new Set();

      mergedItems.forEach(item => {
        const id = item.FOOD_CD || item.foodCd;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          uniqueItems.push(item);
        }
      });

      if (uniqueItems.length > 0) {
        const newMfdsData = uniqueItems.map(item => ({
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
        
        const totalCount1 = parseInt(resFood.data?.body?.totalCount || resFood.data?.response?.body?.totalCount || 0);
        const totalCount2 = parseInt(resMaker.data?.body?.totalCount || resMaker.data?.response?.body?.totalCount || 0);
        setMfdsHasMore((nextPage * 20) < Math.max(totalCount1, totalCount2));
      } else { setMfdsHasMore(false); }
    } catch (error) { setMfdsHasMore(false); } finally { setIsSearchingMore(false); }
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

  const fetchMyFoods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_custom_foods')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyFoodsList(data || []);
    } catch (error) {
      Alert.alert('오류', '나의 메뉴를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMyFood = async (id) => {
    Alert.alert("삭제 확인", "이 메뉴를 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from('user_custom_foods').delete().eq('id', id);
            if (error) throw error;
            setMyFoodsList(prev => prev.filter(item => item.id !== id));
          } catch (error) {
            Alert.alert("오류", "삭제 실패: " + error.message);
          }
        }
      }
    ]);
  };

  const openUpsertModal = (food = null) => {
    if (food) {
      setCustomFoodId(food.id);
      setCustomFoodName(food.food_name);
      setCustomCalories(food.calories.toString());
      setCustomProtein(food.protein.toString());
      setCustomCarbs(food.carbs.toString());
      setCustomFat(food.fat.toString());
    } else {
      setCustomFoodId(null);
      setCustomFoodName('');
      setCustomCalories('');
      setCustomProtein('');
      setCustomCarbs('');
      setCustomFat('');
    }
    setModalMode('upsert_custom');
  };

  const openDirectInputModal = () => {
    setCustomFoodId(null);
    setCustomFoodName('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomCarbs('');
    setCustomFat('');
    setModalMode('direct_input'); 
  };

  const handleDirectInput = () => {
    if (!customFoodName || !customCalories) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수 항목입니다.');
      return;
    }
    const tempFood = {
      food_name: customFoodName,
      calories: parseInt(customCalories) || 0,
      protein: parseInt(customProtein) || 0,
      carbs: parseInt(customCarbs) || 0,
      fat: parseInt(customFat) || 0,
      maker_name: '직접 입력', 
      serving_size: '1인분'
    };
    handleSelectFood(tempFood);
    setCustomFoodName(''); setCustomCalories(''); setCustomProtein(''); setCustomCarbs(''); setCustomFat('');
  };

  const handleSaveCustomFood = async () => {
    if (!customFoodName || !customCalories) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수 항목입니다.');
      return;
    }
    setIsSavingCustomFood(true);
    try {
      const foodData = {
        user_id: session.user.id,
        food_name: customFoodName,
        calories: parseInt(customCalories) || 0,
        protein: parseInt(customProtein) || 0,
        carbs: parseInt(customCarbs) || 0,
        fat: parseInt(customFat) || 0,
        maker_name: '나만의 음식'
      };

      let result;
      if (customFoodId) {
        result = await supabase.from('user_custom_foods').update(foodData).eq('id', customFoodId).select().single();
      } else {
        result = await supabase.from('user_custom_foods').insert([foodData]).select().single();
      }
      
      if (result.error) throw result.error;
      
      await fetchMyFoods();
      setModalMode('my_foods'); 
      Alert.alert('성공', '저장되었습니다.');

    } catch (error) {
      Alert.alert('저장 오류', error.message);
    } finally {
      setIsSavingCustomFood(false);
    }
  };

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFavoritesList(data || []);
    } catch (error) {
      Alert.alert('오류', '즐겨찾기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (food) => {
    try {
      const existing = favoritesList.find(f => f.food_name === food.food_name);
      if (existing) {
        const { error } = await supabase.from('user_favorites').delete().eq('id', existing.id);
        if (error) throw error;
        setFavoritesList(favoritesList.filter(f => f.id !== existing.id));
        Alert.alert('삭제됨', '즐겨찾기에서 삭제되었습니다.');
      } else {
        const newFav = {
          user_id: session.user.id,
          food_name: food.food_name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          serving_size: food.serving_size,
          maker_name: food.maker_name,
        };
        const { data, error } = await supabase.from('user_favorites').insert([newFav]).select().single();
        if (error) throw error;
        setFavoritesList([data, ...favoritesList]);
        Alert.alert('추가됨', '즐겨찾기에 추가되었습니다.');
      }
    } catch (error) { Alert.alert('오류', '즐겨찾기 변경 실패: ' + error.message); }
  };

  const openAddModal = (type) => {
    setMealType(type);
    setModalMode('search');
    setSearchQuery('');
    setSearchResults([]);
    setModalVisible(true);
    fetchFavorites();
  };
  
  const handleOpenMyFoods = () => {
    setModalMode('my_foods');
    fetchMyFoods();
  };

  const handleOpenFavorites = () => {
    setModalMode('favorites');
    fetchFavorites();
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
    if (modalMode === 'my_foods') {
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.modalHeaderContainer}>
            <Text style={styles.modalHeader}>📝 나의 메뉴</Text>
            <Button title="➕ 추가" onPress={() => openUpsertModal()} />
          </View>
          {myFoodsList.length === 0 ? (
            <View style={styles.emptySearchContainer}>
              <Text style={styles.emptyText}>등록된 메뉴가 없습니다.</Text>
            </View>
          ) : (
            <FlatList
              data={myFoodsList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.searchItemContainer}>
                  <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectFood(item)}>
                    <Text style={styles.searchItemName}>{item.food_name}</Text>
                    <Text style={styles.searchItemMacros}>{item.calories} kcal</Text>
                    <Text style={styles.searchItemMacros}>
                      탄: {item.carbs}g | 단: {item.protein}g | 지: {item.fat}g
                    </Text>
                  </TouchableOpacity>
                  <View style={{flexDirection:'row'}}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => openUpsertModal(item)}>
                      <Ionicons name="pencil" size={20} color="gray" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteMyFood(item.id)}>
                      <Ionicons name="trash" size={20} color="red" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
          <View style={{ marginTop: 10 }}>
            <Button title="< 돌아가기" onPress={() => setModalMode('search')} color="gray" />
          </View>
        </View>
      );
    }

    if (modalMode === 'upsert_custom') {
      return (
        <ScrollView>
          <Text style={styles.modalHeader}>
            {customFoodId ? '나의 메뉴 수정' : '새 메뉴 등록'}
          </Text>
          <TextInput style={styles.input} placeholder="음식 이름 (필수)" value={customFoodName} onChangeText={setCustomFoodName} />
          <TextInput style={styles.input} placeholder="칼로리 (필수)" value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="단백질(g)" value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="탄수화물(g)" value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="지방(g)" value={customFat} onChangeText={setCustomFat} keyboardType="numeric" />
          <Button 
            title={isSavingCustomFood ? "저장 중..." : (customFoodId ? "수정 완료" : "등록 하기")} 
            onPress={handleSaveCustomFood} 
            disabled={isSavingCustomFood} 
          />
          <View style={{ marginTop: 10 }}>
            <Button title="< 취소" onPress={() => setModalMode('my_foods')} color="gray" />
          </View>
        </ScrollView>
      );
    }

    // ⭐️ [수정] 직접 입력 (간편 입력 -> 직접 입력)
    if (modalMode === 'direct_input') {
      return (
        <ScrollView>
          <Text style={styles.modalHeader}>⚡️ 직접 입력 (이번만 기록)</Text>
          <TextInput style={styles.input} placeholder="음식 이름 (필수)" value={customFoodName} onChangeText={setCustomFoodName} />
          <TextInput style={styles.input} placeholder="칼로리 (필수)" value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="단백질(g)" value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="탄수화물(g)" value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="지방(g)" value={customFat} onChangeText={setCustomFat} keyboardType="numeric" />
          
          <Button title="입력 완료" onPress={handleDirectInput} />
          
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

    if (modalMode === 'favorites') {
      return (
        <View style={{ flex: 1 }}>
          <Text style={styles.modalHeader}>⭐ 즐겨찾기</Text>
          {favoritesList.length === 0 ? (
            <View style={styles.emptySearchContainer}>
              <Text style={styles.emptyText}>등록된 즐겨찾기가 없습니다.</Text>
            </View>
          ) : (
            <FlatList
              data={favoritesList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.searchItemContainer}>
                  <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectFood(item)}>
                    <Text style={styles.searchItemName}>{item.food_name}</Text>
                    <Text style={styles.searchItemMacros}>{item.calories} kcal</Text>
                    <Text style={styles.searchItemMacros}>
                      탄: {item.carbs}g | 단: {item.protein}g | 지: {item.fat}g
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.starButton} onPress={() => toggleFavorite(item)}>
                    <Ionicons name="star" size={24} color="#FFD700" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
          <View style={{ marginTop: 10 }}>
            <Button title="< 돌아가기" onPress={() => setModalMode('search')} color="gray" />
          </View>
        </View>
      );
    }

    if (modalMode === 'barcode') {
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, position: 'relative' }}>
            <CameraView 
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_e", "qr"], 
              }}
            />
            <View style={[styles.barcodeOverlay, StyleSheet.absoluteFillObject]} pointerEvents="none">
              <Text style={styles.barcodeText}>바코드를 스캔하세요</Text>
            </View>
          </View>
          <Button title="닫기" onPress={() => setModalMode('search')} />
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
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', marginBottom: 10}}>
              <TouchableOpacity style={styles.quickButton} onPress={handleOpenMyFoods}>
                <Text style={styles.quickButtonIcon}>📝</Text>
                <Text style={styles.quickButtonText}>나의 메뉴</Text>
              </TouchableOpacity>
              {/* ⭐️ [수정] 간편 입력 -> 직접 입력 */}
              <TouchableOpacity style={styles.quickButton} onPress={openDirectInputModal}>
                <Text style={styles.quickButtonIcon}>⚡️</Text>
                <Text style={styles.quickButtonText}>직접 입력</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%'}}>
              <TouchableOpacity style={styles.quickButton} onPress={openBarcodeScanner}>
                <Text style={styles.quickButtonIcon}>📷</Text>
                <Text style={styles.quickButtonText}>바코드</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickButton} onPress={handleOpenFavorites}>
                <Text style={styles.quickButtonIcon}>⭐</Text>
                <Text style={styles.quickButtonText}>즐겨찾기</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {isSearching && <ActivityIndicator />}
            <FlatList
              style={{ flex: 1 }} 
              data={searchResults}
              keyExtractor={(item) => `${item.id}-${item.food_name}`}
              renderItem={({ item }) => (
                <View style={styles.searchItemContainer}>
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
                  <TouchableOpacity style={styles.starButton} onPress={() => toggleFavorite(item)}>
                    <Ionicons 
                      name={favoritesList.some(f => f.food_name === item.food_name) ? "star" : "star-outline"} 
                      size={24} 
                      color={favoritesList.some(f => f.food_name === item.food_name) ? "#FFD700" : "#ccc"} 
                    />
                  </TouchableOpacity>
                </View>
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
                        {item.calories}kcal | 탄:{item.carbs}g 단:{item.protein}g 지:{item.fat}g
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
  
  summaryContainer: { padding: 15, backgroundColor: '#fff', borderRadius: 15, marginBottom: 20, marginTop: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
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
  mealSection: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 8 },
  mealTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  mealTotalCal: { fontSize: 14, color: '#888', marginRight: 10 },
  addButton: { backgroundColor: '#f0f0f0', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { fontSize: 20, color: '#007bff', lineHeight: 22 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  logInfo: { flex: 1 },
  logTextFood: { fontSize: 16, color: '#333' },
  logTextMacros: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteButton: { padding: 5 },
  deleteText: { fontSize: 16, color: '#ff4444' },
  noMealText: { color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: 10 },
  modalContainer: { flex: 1, padding: 20, marginTop: 20, backgroundColor: '#fff' },
  modalHeader: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  searchInput: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 15 },
  searchItemContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', paddingRight: 10 },
  searchItem: { flex: 1, padding: 15, borderBottomWidth: 0 },
  searchItemName: { fontSize: 16, fontWeight: 'bold' },
  searchItemMaker: { fontSize: 14, fontWeight: 'normal', color: '#555' },
  searchItemMacros: { fontSize: 14, color: 'gray', marginTop: 4 },
  starButton: { padding: 10 },
  iconButton: { padding: 10 },
  emptySearchContainer: { padding: 20, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: 'gray', padding: 20 },
  // ⭐️ [수정] 버튼 레이아웃 (2줄 정렬, 너비 확장)
  quickButtonsContainer: { 
    flexDirection: 'column', 
    alignItems: 'center', 
    marginTop: 20, 
    marginBottom: 30, 
    paddingHorizontal: 10,
    width: '100%',
  },
  quickButton: { 
    backgroundColor: '#f0f8ff', 
    paddingVertical: 20, 
    borderRadius: 12, 
    width: '48%', // 2개씩 꽉 차게
    height: 90, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderColor: '#007bff', 
    borderWidth: 1, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
    elevation: 2 
  },
  quickButtonIcon: { fontSize: 24, marginBottom: 5 },
  quickButtonText: { fontSize: 16, fontWeight: 'bold', color: '#007bff' },
  closeButtonContainer: { marginTop: 'auto', marginBottom: 20 },
  closeButton: { backgroundColor: '#e0e0e0', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
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
  barcodeOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 50, alignItems: 'center' },
  barcodeText: { color: '#fff', fontSize: 20, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 },
});

export default MealLogger;