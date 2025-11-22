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
  Image,
} from 'react-native';
import axios from 'axios';
import { supabase } from './supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';


const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

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
  
  const [mealType, setMealType] = useState('breakfast');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('search'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [isSavingCustomFood, setIsSavingCustomFood] = useState(false);
  const [myFoodsList, setMyFoodsList] = useState([]); 
  
  const [mfdsPageNo, setMfdsPageNo] = useState(1);
  const [mfdsHasMore, setMfdsHasMore] = useState(false);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const [selectedFood, setSelectedFood] = useState(null);
  const [servingMultiplier, setServingMultiplier] = useState(1.0);
  const [favoritesList, setFavoritesList] = useState([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditingNutrients, setIsEditingNutrients] = useState(false);
  const [aiSearchText, setAiSearchText] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [adjustPurpose, setAdjustPurpose] = useState('log_meal');
  const [selectedLogToView, setSelectedLogToView] = useState(null);


  const onChangeDate = (event, selected) => {
    const currentDate = selected || selectedDate;
    setShowDatePicker(false);
    setSelectedDate(currentDate);
  };
  
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const formatDateMMDD = (date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}.${day}`;
  };
  
  const prevDateObj = new Date(selectedDate);
  prevDateObj.setDate(selectedDate.getDate() - 1);

  const nextDateObj = new Date(selectedDate);
  nextDateObj.setDate(selectedDate.getDate() + 1);

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
  
  const handleDeleteMeal = async (logId) => {
    try {
      const { error } = await supabase.from('meal_logs').delete().eq('id', logId);
      if (error) throw error;
      setLogs(logs.filter((log) => log.id !== logId));
    } catch (error) {
      Alert.alert('오류', '기록 삭제에 실패했습니다: ' + error.message);
    }
  };

  // 식단 기록 터치 시 상세 정보 모달 열기
  const handleOpenLogDetails = (logItem) => {
    setSelectedLogToView(logItem);
    setModalMode('view_details');
    setModalVisible(true);
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

  const handleNutritionScan = async () => {
    Alert.alert("영양성분표 입력", "사진을 어떻게 가져올까요?", [
      {
        text: "카메라 촬영",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true, 
            quality: 0.5,
            allowsEditing: true,
          });
          if (!result.canceled) analyzeImageWithGemini(result.assets[0].base64);
        }
      },
      {
        text: "앨범에서 선택",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert("권한 필요", "사진첩 접근 권한이 필요합니다.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.5,
            allowsEditing: true,
          });
          if (!result.canceled) analyzeImageWithGemini(result.assets[0].base64);
        }
      },
      { text: "취소", style: "cancel" }
    ]);
  };

  const analyzeImageWithGemini = async (base64Image) => {
    setIsAnalyzing(true);
    try {
      const prompt = `
        Analyze this image of a nutrition facts label.
        Extract the following information and return ONLY a JSON object. Use 0 if info is not present.
        - food_name: Name of the product (if not found, use "스캔된 제품")
        - calories: Total calories (number)
        - carbs: Total carbohydrates in grams (number)
        - protein: Protein in grams (number)
        - fat: Total fat in grams (number)
        - sugar: Total sugars in grams (number)
        - fiber: Dietary fiber in grams (number)
        - saturated_fat: Saturated fat in grams (number)
        - trans_fat: Trans fat in grams (number)
        - cholesterol: Cholesterol in mg (number)
        - sodium: Sodium in mg (number)
        - potassium: Potassium in mg (number)
        - serving_size: Serving size text (e.g., "100g", "1 pack")

        Output format raw JSON: {"food_name": "...", "calories": 0, "carbs": 0, "protein": 0, "fat": 0, "sugar": 0, "fiber": 0, "saturated_fat": 0, "trans_fat": 0, "cholesterol": 0, "sodium": 0, "potassium": 0, "serving_size": "..."}
      `;

      const { data, error } = await supabase.functions.invoke('gemini-ai', {
        body: {
          type: 'image_analysis', // 요청 유형 지정
          prompt: prompt,
          imageBase64: base64Image, // 이미지 데이터 전달
          modelName: "gemini-2.5-flash-lite"
        }
      });

      if (error) throw new Error(error.message);
      if (!data || !data.result) throw new Error("AI로부터 결과가 오지 않았습니다.");

      const responseText = data.result; // Edge Function에서 받은 결과 텍스트
      
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      const aiFood = {
        food_name: parsedData.food_name || '스캔된 제품',
        calories: parsedData.calories || 0,
        protein: parsedData.protein || 0,
        carbs: parsedData.carbs || 0,
        fat: parsedData.fat || 0,
        // 상세 영양소
        sugar: parsedData.sugar || 0,
        fiber: parsedData.fiber || 0,
        saturated_fat: parsedData.saturated_fat || 0,
        trans_fat: parsedData.trans_fat || 0,
        cholesterol: parsedData.cholesterol || 0,
        sodium: parsedData.sodium || 0,
        potassium: parsedData.potassium || 0,
        serving_size: parsedData.serving_size || '',
        maker_name: 'Gemini 분석',
        image: `data:image/jpeg;base64,${base64Image}`, 
      };

      handleSelectFood(aiFood);

    } catch (error) {
      console.error("Gemini 분석 오류:", error);
      Alert.alert("분석 실패", "영양성분표를 인식하지 못했습니다: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeTextWithGemini = async () => {
    if (!aiSearchText.trim()) {
      Alert.alert("입력 오류", "음식 내용을 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const prompt = `
        Analyze this food description: "${aiSearchText}".
        Estimate the portion size in grams and detailed nutritional content based on general data.
        
        Return ONLY a JSON object with these numbers (use 0 if unsure):
        - food_name: Concise name (Korean)
        - calories: Total calories
        - carbs: Total carbs (g)
        - protein: Protein (g)
        - fat: Total fat (g)
        - sugar: Sugars (g)
        - fiber: Dietary fiber (g)
        - saturated_fat: Saturated fat (g)
        - trans_fat: Trans fat (g)
        - cholesterol: Cholesterol (mg)
        - sodium: Sodium (mg)
        - potassium: Potassium (mg)
        - serving_size: Estimated serving text

        Output raw JSON example: {"food_name": "피자", "calories": 500, "carbs": 60, "protein": 20, "fat": 25, "sugar": 5, "fiber": 2, "saturated_fat": 10, "trans_fat": 0.5, "cholesterol": 30, "sodium": 800, "potassium": 200, "serving_size": "2조각"}
      `;

      const { data, error } = await supabase.functions.invoke('gemini-ai', {
        body: {
          type: 'text_analysis', // 요청 유형 지정
          prompt: prompt,
          modelName: "gemini-2.5-flash-lite"
        }
      });

      if (error) throw new Error(error.message);
      if (!data || !data.result) throw new Error("AI로부터 결과가 오지 않았습니다.");

      const responseText = data.result; // Edge Function에서 받은 결과 텍스트
      
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      const aiFood = {
        food_name: parsedData.food_name || aiSearchText,
        calories: parsedData.calories || 0,
        protein: parsedData.protein || 0,
        carbs: parsedData.carbs || 0,
        fat: parsedData.fat || 0,
        // 상세 영양소
        sugar: parsedData.sugar || 0,
        fiber: parsedData.fiber || 0,
        saturated_fat: parsedData.saturated_fat || 0,
        trans_fat: parsedData.trans_fat || 0,
        cholesterol: parsedData.cholesterol || 0,
        sodium: parsedData.sodium || 0,
        potassium: parsedData.potassium || 0,
        serving_size: parsedData.serving_size || '1인분',
        maker_name: 'AI 텍스트 분석',
      };

      handleSelectFood(aiFood);

    } catch (error) {
      console.error("Gemini 텍스트 분석 오류:", error);
      Alert.alert("분석 실패", "내용을 이해하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
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

    let mfdsItems = [];

    try {
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
          // 추가된 상세 영양소
          sugar: parseFloat(item.AMT_NUM7 || 0) || 0,         // 당
          fiber: parseFloat(item.AMT_NUM8 || 0) || 0,         // 식이섬유
          sodium: parseFloat(item.AMT_NUM13 || 0) || 0,       // 나트륨
          potassium: parseFloat(item.AMT_NUM12 || 0) || 0,    // 칼륨
          cholesterol: parseFloat(item.AMT_NUM23 || 0) || 0,  // 콜레스테롤
          saturated_fat: parseFloat(item.AMT_NUM24 || 0) || 0,// 포화지방
          trans_fat: parseFloat(item.AMT_NUM25 || 0) || 0,    // 트랜스지방
        }));

        const totalCount1 = parseInt(resFood.data?.body?.totalCount || resFood.data?.response?.body?.totalCount || 0);
        const totalCount2 = parseInt(resMaker.data?.body?.totalCount || resMaker.data?.response?.body?.totalCount || 0);
        setMfdsHasMore((1 * 20) < Math.max(totalCount1, totalCount2));

      } catch (apiError) {
        console.error("API 네트워크 오류", apiError.message);
        setMfdsHasMore(false);
      }
      
      setSearchResults(mfdsItems);

    } catch (error) {
      Alert.alert('검색 오류', '데이터를 불러오는 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
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

  const handleLoadMore = async () => {
      if (isSearchingMore || !mfdsHasMore) return;
      setIsSearchingMore(true);
      const nextPage = mfdsPageNo + 1;
      const MFDS_API_KEY = 'cd9aec01b84399f9af32a83bd4a8ca8284be3e82202c1bd8c56ea667057325f6'; 
      const baseUrl = `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02`;
      const urlFoodName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=${nextPage}&numOfRows=20&type=json&FOOD_NM_KR=${encodeURIComponent(searchQuery)}`;
      const urlMakerName = `${baseUrl}?serviceKey=${MFDS_API_KEY}&pageNo=${nextPage}&numOfRows=20&type=json&MAKER_NM=${encodeURIComponent(searchQuery)}`;
      try {
        const [resFood, resMaker] = await Promise.all([axios.get(urlFoodName).catch(() => ({ data: null })), axios.get(urlMakerName).catch(() => ({ data: null }))]);
        const itemsFood = parseMfdsResponse(resFood.data);
        const itemsMaker = parseMfdsResponse(resMaker.data);
        const mergedItems = [...itemsFood, ...itemsMaker];
        const uniqueItems = [];
        const seenIds = new Set();
        mergedItems.forEach(item => {
          const id = item.FOOD_CD || item.foodCd;
          if (id && !seenIds.has(id)) { seenIds.add(id); uniqueItems.push(item); }
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
            // 추가된 상세 영양소
            sugar: parseFloat(item.AMT_NUM7 || 0) || 0,
            fiber: parseFloat(item.AMT_NUM8 || 0) || 0,
            sodium: parseFloat(item.AMT_NUM13 || 0) || 0,
            potassium: parseFloat(item.AMT_NUM12 || 0) || 0,
            cholesterol: parseFloat(item.AMT_NUM23 || 0) || 0,
            saturated_fat: parseFloat(item.AMT_NUM24 || 0) || 0,
            trans_fat: parseFloat(item.AMT_NUM25 || 0) || 0,
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
    setIsEditingNutrients(false);
    setAdjustPurpose('log_meal'); 
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
        // ⭐️ 추가된 상세 영양소 저장 (반올림)
        sugar: Math.round((selectedFood.sugar || 0) * multiplier),
        fiber: Math.round((selectedFood.fiber || 0) * multiplier),
        saturated_fat: Math.round((selectedFood.saturated_fat || 0) * multiplier),
        trans_fat: Math.round((selectedFood.trans_fat || 0) * multiplier),
        cholesterol: Math.round((selectedFood.cholesterol || 0) * multiplier),
        sodium: Math.round((selectedFood.sodium || 0) * multiplier),
        potassium: Math.round((selectedFood.potassium || 0) * multiplier),
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

  const updateSelectedFood = (key, value) => {
    setSelectedFood(prev => ({
      ...prev,
      [key]: key === 'food_name' ? value : (parseFloat(value) || 0)
    }));
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

  const openCustomFoodModal = (food = null) => {
    if (food) {
      setSelectedFood({ ...food });
      // ⭐️ 상세 영양소 필드가 없는 경우를 대비해 초기화
      setSelectedFood(prev => ({
        ...prev,
        calories: parseFloat(prev.calories) || 0,
        protein: parseFloat(prev.protein) || 0,
        carbs: parseFloat(prev.carbs) || 0,
        fat: parseFloat(prev.fat) || 0,
        sugar: parseFloat(prev.sugar) || 0,
        fiber: parseFloat(prev.fiber) || 0,
        saturated_fat: parseFloat(prev.saturated_fat) || 0,
        trans_fat: parseFloat(prev.trans_fat) || 0,
        cholesterol: parseFloat(prev.cholesterol) || 0,
        sodium: parseFloat(prev.sodium) || 0,
        potassium: parseFloat(prev.potassium) || 0,
      }));
      setAdjustPurpose('update_custom');
    } else {
      // ⭐️ 새 메뉴 추가 시 모든 영양소 0으로 초기화
      setSelectedFood({
        id: Date.now().toString(),
        food_name: '',
        calories: 0, carbs: 0, protein: 0, fat: 0,
        sugar: 0, fiber: 0, saturated_fat: 0, trans_fat: 0,
        cholesterol: 0, sodium: 0, potassium: 0,
        serving_size: '1인분',
        maker_name: '나의 메뉴',
      });
      setAdjustPurpose('save_custom');
    }
    setServingMultiplier(1.0);
    setIsEditingNutrients(false);
    setModalMode('adjust');
  };

  const openDirectInputModal = () => {
    // ⭐️ 직접 입력 시 모든 영양소 0으로 초기화
    setSelectedFood({
      id: Date.now().toString(),
      food_name: '',
      calories: 0, carbs: 0, protein: 0, fat: 0,
      sugar: 0, fiber: 0, saturated_fat: 0, trans_fat: 0,
      cholesterol: 0, sodium: 0, potassium: 0,
      serving_size: '1인분',
      maker_name: '직접 입력',
    });
    setAdjustPurpose('log_meal'); 
    setModalVisible(true);
    setModalMode('adjust');
  };
  
  const handleSaveCustomFood = async () => {
    if (!selectedFood || !selectedFood.food_name || selectedFood.calories === undefined) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수 항목입니다.');
      return;
    }

    if (!session?.user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    setIsSavingCustomFood(true);

    try {
      const foodData = {
        user_id: session.user.id,
        food_name: selectedFood.food_name,
        calories: parseInt(selectedFood.calories) || 0,
        carbs: parseInt(selectedFood.carbs) || 0,
        protein: parseInt(selectedFood.protein) || 0,
        fat: parseInt(selectedFood.fat) || 0,
        serving_size: selectedFood.serving_size || '1인분',
        maker_name: selectedFood.maker_name || '나만의 음식',
      };

      let result;
      if (adjustPurpose === 'update_custom') {
        result = await supabase
          .from('user_custom_foods')
          .update(foodData)
          .eq('id', selectedFood.id)
          .eq('user_id', session.user.id) 
          .select();
      } else {
        result = await supabase
          .from('user_custom_foods')
          .insert([foodData])
          .select();
      }
      
      if (result.error) throw result.error;

      if (result.data === null || result.data.length === 0) {
        throw new Error("데이터를 저장하거나 수정할 수 없습니다. (권한 문제 등)");
      }
      
      await fetchMyFoods();
      setModalMode('my_foods');
      setSelectedFood(null);
      Alert.alert('성공', `나의 메뉴가 ${adjustPurpose === 'update_custom' ? '수정' : '추가'}되었습니다.`);

    } catch (error) {
      console.error("나의 메뉴 저장 오류:", error.message);
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
          sugar: food.sugar || 0,
          fiber: food.fiber || 0,
          saturated_fat: food.saturated_fat || 0,
          trans_fat: food.trans_fat || 0,
          cholesterol: food.cholesterol || 0,
          sodium: food.sodium || 0,
          potassium: food.potassium || 0,
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
  const totalSugar = logs.reduce((sum, log) => sum + (log.sugar || 0), 0);
  const totalSodium = logs.reduce((sum, log) => sum + (log.sodium || 0), 0);

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
            <TouchableOpacity style={styles.addFoodButton} onPress={() => openCustomFoodModal()}>
              <Text style={styles.addFoodButtonText}>+  추가</Text>
            </TouchableOpacity>
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
                      탄수화물: {item.carbs}g | 단백질: {item.protein}g | 지방: {item.fat}g
                    </Text>
                  </TouchableOpacity>
                  <View style={{flexDirection:'row'}}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => openCustomFoodModal(item)}>
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

          <View style={styles.closeButtonContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalMode('search')}>
              <Text style={styles.closeButtonText}>돌아가기</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (modalMode === 'adjust' && selectedFood) {
      let buttonText = '식단에 추가하기';
      let onConfirm = handleConfirmFood;
      let isSaving = isSubmitting;

      if (adjustPurpose === 'save_custom') {
        buttonText = '나의 메뉴 저장';
        onConfirm = handleSaveCustomFood;
        isSaving = isSavingCustomFood;
      } else if (adjustPurpose === 'update_custom') {
        buttonText = '수정 완료';
        onConfirm = handleSaveCustomFood;
        isSaving = isSavingCustomFood;
      }

      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          {selectedFood.image && (
            <Image 
              source={{ uri: selectedFood.image }} 
              style={styles.foodImage} 
              resizeMode="contain" 
            />
          )}

          <TextInput 
            style={styles.modalHeaderInput} 
            value={selectedFood.food_name} 
            onChangeText={(text) => updateSelectedFood('food_name', text)}
          />
          
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

          <View style={styles.adjustedStatsWrapper}>
            {isEditingNutrients ? (
              <ScrollView 
                style={styles.detailedStatsContainer} 
                nestedScrollEnabled={true} 
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.statTextHeader}>상세 영양소 수정 (1인분 기준)</Text>
                
                {/* 칼로리 */}
                <View style={styles.editRowMain}>
                  <Text style={styles.editLabelMain}>🔥 칼로리 (kcal)</Text>
                  <TextInput style={styles.editInput} value={String(selectedFood.calories)} onChangeText={(t) => updateSelectedFood('calories', t)} keyboardType="numeric"/>
                </View>

                {/* 탄수화물 그룹 */}
                <View style={styles.groupContainer}>
                  <View style={styles.editRowMain}>
                    <Text style={styles.editLabelMain}>🍚 탄수화물 (g)</Text>
                    <TextInput style={styles.editInput} value={String(selectedFood.carbs)} onChangeText={(t) => updateSelectedFood('carbs', t)} keyboardType="numeric"/>
                  </View>
                  <View style={styles.editRowSub}>
                    <Text style={styles.editLabelSub}>└ 당 (g)</Text>
                    <TextInput style={styles.editInputSub} value={String(selectedFood.sugar)} onChangeText={(t) => updateSelectedFood('sugar', t)} keyboardType="numeric"/>
                  </View>
                  <View style={styles.editRowSub}>
                    <Text style={styles.editLabelSub}>└ 식이섬유 (g)</Text>
                    <TextInput style={styles.editInputSub} value={String(selectedFood.fiber)} onChangeText={(t) => updateSelectedFood('fiber', t)} keyboardType="numeric"/>
                  </View>
                </View>

                {/* 단백질 */}
                <View style={styles.editRowMain}>
                  <Text style={styles.editLabelMain}>🥩 단백질 (g)</Text>
                  <TextInput style={styles.editInput} value={String(selectedFood.protein)} onChangeText={(t) => updateSelectedFood('protein', t)} keyboardType="numeric"/>
                </View>
                
                {/* 지방 그룹 */}
                <View style={styles.groupContainer}>
                  <View style={styles.editRowMain}>
                    <Text style={styles.editLabelMain}>🥑 지방 (g)</Text>
                    <TextInput style={styles.editInput} value={String(selectedFood.fat)} onChangeText={(t) => updateSelectedFood('fat', t)} keyboardType="numeric"/>
                  </View>
                  <View style={styles.editRowSub}>
                    <Text style={styles.editLabelSub}>└ 포화지방 (g)</Text>
                    <TextInput style={styles.editInputSub} value={String(selectedFood.saturated_fat)} onChangeText={(t) => updateSelectedFood('saturated_fat', t)} keyboardType="numeric"/>
                  </View>
                  <View style={styles.editRowSub}>
                    <Text style={styles.editLabelSub}>└ 트랜스지방 (g)</Text>
                    <TextInput style={styles.editInputSub} value={String(selectedFood.trans_fat)} onChangeText={(t) => updateSelectedFood('trans_fat', t)} keyboardType="numeric"/>
                  </View>
                </View>

                {/* 기타 영양소 */}
                <View style={styles.editRowMain}><Text style={styles.editLabelMain}>🥚 콜레스테롤 (mg)</Text><TextInput style={styles.editInput} value={String(selectedFood.cholesterol)} onChangeText={(t) => updateSelectedFood('cholesterol', t)} keyboardType="numeric"/></View>
                <View style={styles.editRowMain}><Text style={styles.editLabelMain}>🧂 나트륨 (mg)</Text><TextInput style={styles.editInput} value={String(selectedFood.sodium)} onChangeText={(t) => updateSelectedFood('sodium', t)} keyboardType="numeric"/></View>
                <View style={styles.editRowMain}><Text style={styles.editLabelMain}>🍌 칼륨 (mg)</Text><TextInput style={styles.editInput} value={String(selectedFood.potassium)} onChangeText={(t) => updateSelectedFood('potassium', t)} keyboardType="numeric"/></View>

                <TouchableOpacity style={styles.foldButton} onPress={() => setIsEditingNutrients(false)}>
                  <Text style={styles.foldButtonText}>▲ 간단히 보기</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              // -----------------------------------------------------
              // ⭐️ 기본 보기 모드 (주요 4대 영양소만 표시)
              // -----------------------------------------------------
              <View style={styles.simpleStatsContainer}>
                <Text style={styles.statTextHeader}>주요 영양소 (현재 분량 기준)</Text>
                <View style={styles.simpleStatRow}>
                  <Text style={styles.statLabel}>🔥 칼로리</Text>
                  <Text style={styles.statValue}>{Math.round(selectedFood.calories * servingMultiplier)} kcal</Text>
                </View>
                <View style={styles.simpleStatRow}>
                  <Text style={styles.statLabel}>🍚 탄수화물</Text>
                  <Text style={styles.statValue}>{Math.round(selectedFood.carbs * servingMultiplier)} g</Text>
                </View>
                <View style={styles.simpleStatRow}>
                  <Text style={styles.statLabel}>🥩 단백질</Text>
                  <Text style={styles.statValue}>{Math.round(selectedFood.protein * servingMultiplier)} g</Text>
                </View>
                <View style={styles.simpleStatRow}>
                  <Text style={styles.statLabel}>🥑 지방</Text>
                  <Text style={styles.statValue}>{Math.round(selectedFood.fat * servingMultiplier)} g</Text>
                </View>
                
                <TouchableOpacity style={styles.detailButton} onPress={() => setIsEditingNutrients(true)}>
                  <Text style={styles.detailButtonText}>🔽 영양소 상세 보기 및 수정</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={onConfirm} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>{buttonText}</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelButton} onPress={() => {
            if (adjustPurpose === 'save_custom' || adjustPurpose === 'update_custom') {
              setModalMode('my_foods');
            } else {
              setModalMode('search');
            }
          }}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </ScrollView>
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
            />
          )}

          <View style={styles.closeButtonContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalMode('search')}>
              <Text style={styles.closeButtonText}>돌아가기</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (modalMode === 'ai_image') {
      return (
        <View style={{ flex: 1 }}>
           {isAnalyzing && (
             <View style={styles.loadingOverlay}>
               <View style={styles.loadingBox}>
                 <ActivityIndicator size="large" color="#007bff" />
                 <Text style={styles.loadingText}>AI가 영양성분표를 분석 중입니다...</Text>
                 <Text style={styles.loadingSubText}>잠시만 기다려주세요.</Text>
               </View>
             </View>
           )}
           
           <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <Text style={{ fontSize: 16, color: '#555', marginBottom: 20, textAlign: 'center' }}>
               식품 포장지의 영양정보 표를{'\n'}촬영하거나 앨범에서 선택하세요.
             </Text>
             <Button title="📸 촬영 / 앨범 선택" onPress={handleNutritionScan} />
           </View>

           <View style={{ padding: 20 }}>
             <Button title="닫기" onPress={() => setModalMode('search')} color="gray" />
           </View>
        </View>
      );
    }

    if (modalMode === 'ai_text') {
      return (
        <View style={{ flex: 1 }}>
           <Text style={styles.modalHeader}>💬 AI에게 물어보기</Text>
           
           <View style={{ flex: 1, padding: 20 }}>
             <Text style={{ fontSize: 16, color: '#555', marginBottom: 10 }}>
               먹은 음식을 자유롭게 적어주세요.{'\n'}
               (예: 피자 2조각, 사과 1개, 닭가슴살 100g)
             </Text>
             
             <TextInput
               style={[styles.input, { height: 100, textAlignVertical: 'top', padding: 10 }]}
               placeholder="여기에 입력하세요..."
               multiline={true}
               value={aiSearchText}
               onChangeText={setAiSearchText}
             />
             
             <TouchableOpacity style={[styles.saveButton, { marginTop: 20 }]} onPress={analyzeTextWithGemini}>
                {isAnalyzing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>🔍 분석 시작</Text>
                )}
             </TouchableOpacity>
           </View>

           <View style={styles.closeButtonContainer}>
             <TouchableOpacity style={styles.closeButton} onPress={() => setModalMode('search')}>
               <Text style={styles.closeButtonText}>돌아가기</Text>
             </TouchableOpacity>
           </View>
        </View>
      );
    }

    if (modalMode === 'view_details' && selectedLogToView) {
      const item = selectedLogToView;
      return (
        <View style={{ flex: 1 }}>
          <Text style={styles.modalHeader}>{item.food_name}</Text>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={styles.simpleStatsContainer}>
              <Text style={styles.statTextHeader}>섭취 영양소 정보</Text>
              
              {/* 칼로리 */}
              <View style={styles.simpleStatRow}><Text style={styles.statLabel}>🔥 칼로리</Text><Text style={styles.statValue}>{item.calories} kcal</Text></View>

              {/* 탄수화물 그룹 */}
              <View style={styles.viewRowHeader}><Text style={styles.statLabel}>🍚 탄수화물</Text><Text style={styles.statValue}>{item.carbs} g</Text></View>
              <View style={styles.viewRowSub}><Text style={styles.viewLabelSub}>- 당</Text><Text style={styles.viewValueSub}>{item.sugar || 0} g</Text></View>
              <View style={styles.viewRowSubLast}><Text style={styles.viewLabelSub}>- 식이섬유</Text><Text style={styles.viewValueSub}>{item.fiber || 0} g</Text></View>

              {/* 단백질 */}
              <View style={styles.simpleStatRow}><Text style={styles.statLabel}>🥩 단백질</Text><Text style={styles.statValue}>{item.protein} g</Text></View>

              {/* 지방 그룹 */}
              <View style={styles.viewRowHeader}><Text style={styles.statLabel}>🥑 지방</Text><Text style={styles.statValue}>{item.fat} g</Text></View>
              <View style={styles.viewRowSub}><Text style={styles.viewLabelSub}>- 포화지방</Text><Text style={styles.viewValueSub}>{item.saturated_fat || 0} g</Text></View>
              <View style={styles.viewRowSubLast}><Text style={styles.viewLabelSub}>- 트랜스지방</Text><Text style={styles.viewValueSub}>{item.trans_fat || 0} g</Text></View>

              {/* 기타 영양소 */}
              <View style={styles.simpleStatRow}><Text style={styles.statLabel}>🥚 콜레스테롤</Text><Text style={styles.statValue}>{item.cholesterol || 0} mg</Text></View>
              <View style={styles.simpleStatRow}><Text style={styles.statLabel}>🧂 나트륨</Text><Text style={styles.statValue}>{item.sodium || 0} mg</Text></View>
              <View style={styles.simpleStatRow}><Text style={styles.statLabel}>🍌 칼륨</Text><Text style={styles.statValue}>{item.potassium || 0} mg</Text></View>
            </View>
          </ScrollView>

          <View style={styles.closeButtonContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.modalHeaderContainer}>
          <Text style={styles.modalHeader}>{MEAL_TYPES.find(t=>t.key===mealType)?.label} 메뉴 추가</Text>
          
          <TouchableOpacity style={styles.headerFavoriteButton} onPress={handleOpenFavorites}>
            <Ionicons name="star" size={28} color="#FFD700" />
          </TouchableOpacity>
        </View>

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
              <TouchableOpacity style={styles.quickButton} onPress={openDirectInputModal}>
                <Text style={styles.quickButtonIcon}>⚡️</Text>
                <Text style={styles.quickButtonText}>직접 입력</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', marginBottom: 10}}>
               <TouchableOpacity style={styles.quickButton} onPress={() => {
                  setAiSearchText(''); 
                  setModalMode('ai_text'); 
               }}>
                <Text style={styles.quickButtonIcon}>💬</Text>
                <Text style={styles.quickButtonText}>AI 검색</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickButton} onPress={handleNutritionScan}>
                <Text style={styles.quickButtonIcon}>📸</Text>
                <Text style={styles.quickButtonText}>영양정보 촬영</Text>
              </TouchableOpacity>
            </View>

            <View style={{flexDirection:'row', justifyContent:'flex-start', width:'100%'}}>
              {/* 빈 공간 */}
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
        <SafeAreaView style={styles.modalContainer}>
          
          {isAnalyzing && (
             <View style={styles.loadingOverlay}>
               <View style={styles.loadingBox}>
                 <ActivityIndicator size="large" color="#007bff" />
                 <Text style={styles.loadingText}>AI가 영양성분표를 분석 중입니다...</Text>
                 <Text style={styles.loadingSubText}>잠시만 기다려주세요.</Text>
               </View>
             </View>
           )}
           
          {renderModalContent()}
        </SafeAreaView>
      </Modal>

      <ScrollView style={styles.container}>
        <View style={styles.summaryContainer}>
          
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.yearText}>{selectedDate.getFullYear()}</Text>
            <View style={styles.dateNavRow}>
              <TouchableOpacity onPress={handlePrevDay} style={styles.navButton}>
                <Text style={styles.navTextSmall}>{formatDateMMDD(prevDateObj)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateTextLarge}>
                  {formatDateMMDD(selectedDate)}
                  {isSameDay(selectedDate, new Date()) && <Text style={styles.todayTextSmall}> (오늘)</Text>}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextDay} style={styles.navButton}>
                <Text style={styles.navTextSmall}>{formatDateMMDD(nextDateObj)}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
          <Text style={styles.calorieSummary}>
            {totalCalories} <Text style={styles.calorieGoalText}>/ {goalCalories} kcal</Text>
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: progressBarColor }]} />
          </View>

          {/* ⭐️ 주요 3대 영양소 */}
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

          <View style={styles.additionalMacroSummarySingleLine}>
            <Text style={styles.additionalMacroText}>
              당류 <Text style={styles.additionalMacroValue}>{totalSugar}g</Text>
            </Text>
            <Text style={[styles.additionalMacroText, { marginLeft: 40 }]}>
              나트륨 <Text style={styles.additionalMacroValue}>{totalSodium}mg</Text>
            </Text>
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
                    {/* 식단 정보 부분을 터치 가능하게 변경하여 상세 보기 연결 */}
                    <TouchableOpacity style={styles.logInfo} onPress={() => handleOpenLogDetails(item)}>
                      <Text style={styles.logTextFood}>{item.food_name}</Text>
                      <Text style={styles.logTextMacros}>
                        {item.calories}kcal | 탄수화물:{item.carbs}g 단백질:{item.protein}g 지방:{item.fat}g
                      </Text>
                    </TouchableOpacity>
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
  modalHeaderContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative', 
    width: '100%', 
  },
  modalHeader: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center',
  },
  headerFavoriteButton: {
    position: 'absolute', 
    right: 0,             
    padding: 5,
  },
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
  quickButtonsContainer: { 
    flexDirection: 'column', 
    alignItems: 'center', 
    marginTop: 20, 
    marginBottom: 30, 
    paddingHorizontal: 10, 
    width: '100%' 
  },
  quickButton: { backgroundColor: '#f0f8ff', paddingVertical: 20, borderRadius: 12, width: '48%', height: 90, alignItems: 'center', justifyContent: 'center', borderColor: '#007bff', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  quickButtonIcon: { fontSize: 24, marginBottom: 5 },
  quickButtonText: { fontSize: 14, fontWeight: 'bold', color: '#007bff' },
  closeButtonContainer: { marginTop: 'auto', marginBottom: 20 },
  closeButton: { backgroundColor: '#e0e0e0', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  adjustContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 30 },
  adjustBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  adjustBtnText: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  multiplierText: { fontSize: 32, fontWeight: 'bold', marginHorizontal: 20, color: '#007bff' },
  
  adjustedStatsWrapper: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  
  simpleStatsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  statTextHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  simpleStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  statLabel: { fontSize: 16, color: '#333' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#007bff' },
  detailButton: {
    marginTop: 10,
    paddingVertical: 10,
  },
  detailButtonText: {
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  detailedStatsContainer: {
    maxHeight: 350, 
    width: '100%',
    padding: 15,
    backgroundColor: '#fcfcfc',
  },
  groupContainer: {
    backgroundColor: '#f4f6f8', 
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  editRowMain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  editLabelMain: { fontSize: 15, fontWeight: 'bold', width: '45%', color: '#333' },
  editInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, width: '50%', backgroundColor: '#fff', fontSize: 15, textAlign: 'right'
  },
  editRowSub: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
    paddingLeft: 20, 
  },
  editLabelSub: { fontSize: 14, color: '#666', width: '45%' },
  editInputSub: {
    borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 6, width: '50%', backgroundColor: '#fff', fontSize: 14, textAlign: 'right', color: '#555'
  },
  foldButton: {
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 10,
  },
  foldButtonText: { color: '#888', fontWeight: 'bold' },

  saveButton: { backgroundColor: '#007bff', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 15, alignItems: 'center' },
  cancelButtonText: { color: 'gray', fontSize: 16 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 10 },
  
  dateHeaderContainer: {
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  yearText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    marginBottom: 5,
  },
  dateNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10, 
  },
  navButton: {
    padding: 10, 
  },
  navTextSmall: {
    fontSize: 18,      
    color: '#888',
    fontWeight: '600', 
  },
  dateTextLarge: {
    fontSize: 28, 
    fontWeight: 'bold',
    color: '#333',
    textAlignVertical: 'bottom', 
  },
  todayTextSmall: {
    fontSize: 16,    
    color: '#888',   
    fontWeight: 'normal', 
  },
  disabledText: {
    color: '#e0e0e0', 
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, 
  },
  loadingBox: {
    width: 280,
    backgroundColor: 'white',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
    textAlign: 'center'
  },
  loadingSubText: {
    marginTop: 5,
    color: '#777',
    fontSize: 12,
  },
  
  modalHeaderInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 5,
  },
  foodImage: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    marginBottom: 20,
    backgroundColor: '#f0f0f0', 
  },
  confirmButton: {
    backgroundColor: '#007bff', 
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '40%',
    alignSelf: 'center', 
  },
  confirmButtonText: {
    color: 'white', 
    fontSize: 16,
    fontWeight: 'bold',
  },
  addFoodButton: { 
    backgroundColor: '#007bff', 
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10, 
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute', 
    right: 0,             
  },
  addFoodButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    width: '100%',
    marginVertical: 15,
  },
  viewRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4, 
  },
  viewRowSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
    paddingLeft: 20, 
  },
  viewRowSubLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    paddingBottom: 8,
    paddingLeft: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f5f5f5',
  },
  viewLabelSub: {
    fontSize: 14,
    color: '#666',
  },
  viewValueSub: {
    fontSize: 14,
    color: '#333',
  },
  additionalMacroSummarySingleLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ffffff',
  },
  additionalMacroText: {
    fontSize: 14,
    color: '#777',
  },
  additionalMacroValue: {
    fontWeight: 'bold',
    color: '#777',
  },

});

export default MealLogger;