// StatisticsScreen.js

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Dimensions, 
  ScrollView, 
  Button, 
  Alert, 
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  VictoryChart, 
  VictoryBar, 
  VictoryAxis, 
  VictoryTheme, 
  VictoryLabel, 
  VictoryPie, 
  VictoryStack 
} from 'victory-native';
import { Svg } from 'react-native-svg';
import { supabase } from './supabaseClient';
import { getFormattedDate } from './MealLogger';

const StatisticsScreen = ({ session }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 40;
  const cellWidth = (screenWidth - 52) / 7; 

  const [loading, setLoading] = useState(true);
  const [goalCalories, setGoalCalories] = useState(0);
  const [dailyGoalNutrients, setDailyGoalNutrients] = useState({ carbs: 0, protein: 0, fat: 0 });
  
  const [viewMode, setViewMode] = useState('weekly');

  // 주간 통계용 State
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateRangeText, setDateRangeText] = useState('');
  const [currentYear, setCurrentYear] = useState('');
  const [weeklyNutrients, setWeeklyNutrients] = useState({ carbs: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 });
  const [avgCalories, setAvgCalories] = useState(0);
  const [successDays, setSuccessDays] = useState(0);
  const [mealTypeData, setMealTypeData] = useState({ breakfast: [], lunch: [], dinner: [], snack: [] });
  const [dailyTotalData, setDailyTotalData] = useState([]);
  const [chartData, setChartData] = useState([]);

  // 월간 통계용 State
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [monthlyData, setMonthlyData] = useState({}); 
  const [selectedDateDetail, setSelectedDateDetail] = useState(null); 

  useEffect(() => {
    if (session) {
      if (viewMode === 'weekly') {
        fetchWeeklyStatistics();
      } else {
        fetchMonthlyStatistics();
      }
    }
  }, [session, viewMode, weekOffset, currentMonth]);

  const renderNutrientBar = (label, value, goal, percent, colorMain, colorLight) => {
    const isOver = percent > 100;
    const barHeight = Math.min(percent, 100); 
    
    return (
      <View style={styles.nutrientBarItem}>
        <Text style={[styles.nutrientBarLabel, { color: colorMain }]}>{label}</Text>
        
        <View style={styles.barWrapper}>
          <View style={[styles.barBackground, { backgroundColor: colorLight }]} />
          <View style={[
            styles.barFill, 
            { 
              height: `${barHeight}%`, 
              backgroundColor: colorMain,
            }
          ]} />
          {isOver && (
            <View style={styles.warningIcon}> 
              <Text style={{fontSize:12}}>⚠️</Text>
            </View>
          )}
        </View>

        <Text style={styles.nutrientBarValue}>{Math.round(value)}/{Math.round(goal)}g</Text>
        <Text style={[styles.nutrientBarPercent, isOver ? styles.textRed : null]}>
          {percent}%
        </Text>
      </View>
    );
  };

  const fetchWeeklyStatistics = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('goal_calories, recommend_carbs, recommend_protein, recommend_fat')
        .eq('user_id', session.user.id)
        .single();

      if (profileData) {
        setGoalCalories(profileData.goal_calories || 0);
        setDailyGoalNutrients({
          carbs: profileData.recommend_carbs || 0,
          protein: profileData.recommend_protein || 0,
          fat: profileData.recommend_fat || 0,
        });
      }

      const today = new Date();
      today.setDate(today.getDate() - (weekOffset * 7));
      const periodEndDate = new Date(today);
      const periodStartDate = new Date(today);
      periodStartDate.setDate(today.getDate() - 6);

      const formatDateSimple = (date) => {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}.${day}`;
      };
      
      setCurrentYear(periodEndDate.getFullYear().toString());
      setDateRangeText(`${formatDateSimple(periodStartDate)} ~ ${formatDateSimple(periodEndDate)}`);

      const { data: logsData, error: logsError } = await supabase
        .from('meal_logs')
        .select('date, meal_type, calories, protein, carbs, fat, sugar, sodium')
        .eq('user_id', session.user.id)
        .gte('date', getFormattedDate(periodStartDate))
        .lte('date', getFormattedDate(periodEndDate))
        .order('date', { ascending: true });

      if (logsError) throw logsError;

      let totalCarbs = 0, totalProtein = 0, totalFat = 0;
      let totalSugar = 0, totalSodium = 0;
      let totalWeeklyCalories = 0;
      let daysWithRecords = new Set();
      let dailyMap = {}; 
      
      const initData = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(periodStartDate);
        d.setDate(periodStartDate.getDate() + i);
        const dateStr = getFormattedDate(d);
        const dayLabel = `${d.getDate()}일`;
        initData.push({ x: dayLabel, y: 0, date: dateStr });
        dailyMap[dateStr] = 0;
      }

      const newMealData = {
        breakfast: JSON.parse(JSON.stringify(initData)),
        lunch: JSON.parse(JSON.stringify(initData)),
        dinner: JSON.parse(JSON.stringify(initData)),
        snack: JSON.parse(JSON.stringify(initData)),
      };
      const newDailyTotal = JSON.parse(JSON.stringify(initData));

      logsData.forEach(log => {
        const dateStr = log.date;
        daysWithRecords.add(dateStr);
        totalCarbs += log.carbs || 0;
        totalProtein += log.protein || 0;
        totalFat += log.fat || 0;
        totalSugar += log.sugar || 0;
        totalSodium += log.sodium || 0;
        
        totalWeeklyCalories += log.calories || 0;
        dailyMap[dateStr] += log.calories || 0;

        if (newMealData[log.meal_type]) {
          const target = newMealData[log.meal_type].find(item => item.date === dateStr);
          if (target) target.y += log.calories;
        }
        const totalTarget = newDailyTotal.find(item => item.date === dateStr);
        if (totalTarget) totalTarget.y += log.calories;
      });

      const recordDaysCount = daysWithRecords.size || 1;
      setAvgCalories(Math.round(totalWeeklyCalories / recordDaysCount));
      setWeeklyNutrients({ carbs: totalCarbs, protein: totalProtein, fat: totalFat, sugar: totalSugar, sodium: totalSodium });
      setMealTypeData(newMealData);
      setDailyTotalData(newDailyTotal);
      setChartData(newDailyTotal); 

      let success = 0;
      const goal = profileData?.goal_calories || 0;
      if (goal > 0) {
        Object.values(dailyMap).forEach(cal => {
          if (cal > 0 && cal <= goal * 1.1) success++;
        });
      }
      setSuccessDays(success);

    } catch (error) {
      console.error('주간 통계 로딩 오류:', error);
      Alert.alert('오류', '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyStatistics = async () => {
    setLoading(true);
    setSelectedDateDetail(null); 
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('goal_calories, recommend_carbs, recommend_protein, recommend_fat')
        .eq('user_id', session.user.id)
        .single();
      
      if (profileData) {
        setGoalCalories(profileData.goal_calories || 0);
        setDailyGoalNutrients({
          carbs: profileData.recommend_carbs || 0,
          protein: profileData.recommend_protein || 0,
          fat: profileData.recommend_fat || 0,
        });
      }

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const { data: logsData, error } = await supabase
        .from('meal_logs')
        .select('date, calories, protein, carbs, fat, sugar, fiber, saturated_fat, trans_fat, cholesterol, sodium, potassium')
        .eq('user_id', session.user.id)
        .gte('date', getFormattedDate(startDate))
        .lte('date', getFormattedDate(endDate));

      if (error) throw error;

      const map = {};
      logsData.forEach(log => {
        const d = log.date;
        if (!map[d]) {
          map[d] = { 
            calories: 0, 
            carbs: 0, 
            protein: 0, 
            fat: 0,
            sugar: 0,
            fiber: 0,
            saturated_fat: 0,
            trans_fat: 0,
            cholesterol: 0,
            sodium: 0,
            potassium: 0,
          };
        }
        map[d].calories += log.calories || 0;
        map[d].carbs += log.carbs || 0;
        map[d].protein += log.protein || 0;
        map[d].fat += log.fat || 0;
        map[d].sugar += log.sugar || 0;
        map[d].fiber += log.fiber || 0;
        map[d].saturated_fat += log.saturated_fat || 0;
        map[d].trans_fat += log.trans_fat || 0;
        map[d].cholesterol += log.cholesterol || 0;
        map[d].sodium += log.sodium || 0;
        map[d].potassium += log.potassium || 0;
      });
      setMonthlyData(map);

    } catch (error) {
      console.error('월간 통계 로딩 오류:', error);
      Alert.alert('오류', '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => setWeekOffset(weekOffset + 1);
  const handleNextWeek = () => setWeekOffset(weekOffset - 1);

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };
  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const handleDayPress = (dateStr, data) => {
    if (!data) {
      setSelectedDateDetail(null);
      return;
    }
    setSelectedDateDetail({ date: dateStr, ...data });
  };

  const renderWeeklyView = () => {
    const stackColors = ['#FFCC80', '#FFAB91', '#CE93D8', '#90CAF9']; 

    const maxDailyCal = dailyTotalData.length > 0 ? Math.max(...dailyTotalData.map(d => d.y)) : 0;
    const maxDomain = Math.max(maxDailyCal, goalCalories) * 1.3 || 2000;

    const weeklyGoalCarbs = dailyGoalNutrients.carbs * 7;
    const weeklyGoalProtein = dailyGoalNutrients.protein * 7;
    const weeklyGoalFat = dailyGoalNutrients.fat * 7;

    const carbsP = weeklyGoalCarbs > 0 ? Math.round((weeklyNutrients.carbs / weeklyGoalCarbs) * 100) : 0;
    const proteinP = weeklyGoalProtein > 0 ? Math.round((weeklyNutrients.protein / weeklyGoalProtein) * 100) : 0;
    const fatP = weeklyGoalFat > 0 ? Math.round((weeklyNutrients.fat / weeklyGoalFat) * 100) : 0;

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.yearHeader}>{currentYear}</Text>
          <View style={styles.dateNavigator}>
            <TouchableOpacity onPress={handlePrevWeek} style={styles.navButton}>
              <Text style={styles.navText}>◀ 이전 7일</Text>
            </TouchableOpacity>
            <Text style={styles.dateHeader}>{dateRangeText}</Text>
            <TouchableOpacity onPress={handleNextWeek} style={styles.navButton}>
              <Text style={styles.navText}>다음 7일 ▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>목표 달성</Text>
              <Text style={styles.summaryValue}>
                <Text style={{color: '#4CAF50'}}>{successDays}</Text>
                <Text> / 7일</Text>
              </Text>
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>일일 평균</Text>
              <Text style={styles.summaryValue}>{avgCalories} / {goalCalories} kcal</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>주간 영양소 섭취량</Text>
          <View style={styles.nutrientBarContainer}>
            {renderNutrientBar('탄수화물', weeklyNutrients.carbs, weeklyGoalCarbs, carbsP, '#2196F3', '#E3F2FD')}
            {renderNutrientBar('단백질', weeklyNutrients.protein, weeklyGoalProtein, proteinP, '#F44336', '#FFEBEE')}
            {renderNutrientBar('지방', weeklyNutrients.fat, weeklyGoalFat, fatP, '#FBC02D', '#FFF9C4')}
          </View>

          <View style={styles.additionalNutrientContainerSingleLine}>
            <Text style={styles.additionalNutrientText}>
              당류 <Text style={styles.additionalNutrientValue}>{weeklyNutrients.sugar}g</Text>
            </Text>
            <Text style={[styles.additionalNutrientText, { marginLeft: 25 }]}>
              나트륨 <Text style={styles.additionalNutrientValue}>{weeklyNutrients.sodium}mg</Text>
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>일별/끼니별 칼로리</Text>
          <View style={styles.stackLegend}>
            <Text style={[styles.stackLegendText, {color:stackColors[0]}]}>●아침</Text>
            <Text style={[styles.stackLegendText, {color:stackColors[1]}]}>●점심</Text>
            <Text style={[styles.stackLegendText, {color:stackColors[2]}]}>●저녁</Text>
            <Text style={[styles.stackLegendText, {color:stackColors[3]}]}>●간식</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Svg width={chartWidth} height={300}>
              <VictoryChart domainPadding={{ x: 20 }} theme={VictoryTheme.material} height={300} width={chartWidth} padding={{ top: 30, bottom: 50, left: 60, right: 30 }} domain={{ y: [0, maxDomain] }}>
                {goalCalories > 0 && (
                  <VictoryAxis 
                    dependentAxis 
                    standalone={false} 
                    tickValues={[goalCalories]} 
                    tickFormat={['']} 
                    style={{ 
                      grid: { stroke: "red", strokeDasharray: "4, 4" }, 
                      axis: { stroke: "none" }
                    }} 
                  />
                )}
                <VictoryAxis style={{ axis: { stroke: "#756f6a" }, tickLabels: { fontSize: 12, padding: 5, angle: 0 } }} />
                <VictoryAxis dependentAxis tickFormat={(tick) => `${tick}`} style={{ axis: { stroke: "none" }, tickLabels: { fill: "#000", fontSize: 10, padding: 5 }, grid: { stroke: "lightgray", strokeDasharray: "5, 5" } }} />
                <VictoryStack colorScale={stackColors}>
                  <VictoryBar data={mealTypeData.breakfast} x="x" y="y" barWidth={12} cornerRadius={{ top: 2 }}/>
                  <VictoryBar data={mealTypeData.lunch} x="x" y="y" barWidth={12} cornerRadius={{ top: 2 }}/>
                  <VictoryBar data={mealTypeData.dinner} x="x" y="y" barWidth={12} cornerRadius={{ top: 2 }}/>
                  <VictoryBar data={mealTypeData.snack} x="x" y="y" barWidth={12} cornerRadius={{ top: 2 }}/>
                </VictoryStack>
              </VictoryChart>
            </Svg>
          </ScrollView>
        </View>
        <View style={{ height: 50 }} />
      </ScrollView>
    );
  };

  const renderMonthlyView = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); 

    const calendarDays = [];
    for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.dateNavigator}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Text style={styles.navText}>◀ 이전 달</Text>
            </TouchableOpacity>
            <Text style={styles.dateHeader}>{year}년 {month + 1}월</Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <Text style={styles.navText}>다음 달 ▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <Text style={styles.chartTitle}>일별 칼로리 달성률</Text>
          <View style={styles.weekRow}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <Text key={i} style={[
                styles.dayHeader, 
                { width: cellWidth }, 
                i === 0 ? {color:'#F44336'} : null, 
                i === 6 ? {color:'#2196F3'} : null
              ]}>{d}</Text>
            ))}
          </View>
          
          <View style={styles.daysGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) return <View key={index} style={[styles.dayCellEmpty, { width: cellWidth }]} />;
              
              const dateStr = getFormattedDate(new Date(year, month, day));
              const dayData = monthlyData[dateStr];
              const intake = dayData?.calories || 0;
              const percent = goalCalories > 0 ? Math.round((intake / goalCalories) * 100) : 0;
              
              let percentColor = '#888'; 
              if (percent >= 90 && percent <= 100) {
                percentColor = '#007bff';
              } else if (percent > 100) {
                percentColor = '#F44336';
              }
              
              const isSelected = selectedDateDetail?.date === dateStr;

              return (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.dayCell, 
                    { width: cellWidth },
                    isSelected ? styles.selectedDayCell : null 
                  ]}
                  onPress={() => handleDayPress(dateStr, dayData)}
                >
                  <Text style={[
                    styles.dayNumber, 
                    index % 7 === 0 ? {color:'#F44336'} : null, 
                    index % 7 === 6 ? {color:'#2196F3'} : null
                  ]}>
                    {day}
                  </Text>
                  {intake > 0 ? (
                    <View style={styles.cellContent}>
                      <Text style={[styles.cellPercent, { color: percentColor }]}>
                        {percent}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noRecordText}>-</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        {selectedDateDetail ? (
          <ScrollView style={styles.card}> 
            <Text style={styles.cardTitle}>
              {(() => {
                const [y, m, d] = selectedDateDetail.date.split('-');
                const day = parseInt(d, 10);
                return `${day}일`;
              })()} 상세 정보
            </Text>
            
            <View style={{marginBottom: 20, alignItems: 'center'}}>
              <Text style={{fontSize: 16, color: '#333', marginBottom: 5}}>총 섭취 칼로리</Text>
              <Text style={{fontSize: 24, fontWeight:'bold', color: '#007bff'}}>
                {selectedDateDetail.calories} <Text style={{fontSize: 16, color: '#333'}}>/ {goalCalories} kcal</Text>
              </Text>
            </View>

            <View style={styles.simpleStatsContainer}>
              <Text style={styles.statTextHeader}>섭취 영양소 정보</Text>
              
              <View style={styles.simpleStatRow}>
                <Text style={styles.statLabel}>🔥 칼로리</Text>
                <Text style={styles.statValue}>{selectedDateDetail.calories} kcal</Text>
              </View>

              <View style={styles.viewRowHeader}>
                <Text style={styles.statLabel}>🍚 탄수화물</Text>
                <Text style={styles.statValue}>{selectedDateDetail.carbs} g</Text>
              </View>
              <View style={styles.viewRowSub}>
                <Text style={styles.viewLabelSub}>- 당</Text>
                <Text style={styles.viewValueSub}>{selectedDateDetail.sugar || 0} g</Text>
              </View>
              <View style={styles.viewRowSubLast}>
                <Text style={styles.viewLabelSub}>- 식이섬유</Text>
                <Text style={styles.viewValueSub}>{selectedDateDetail.fiber || 0} g</Text>
              </View>

              <View style={styles.simpleStatRow}>
                <Text style={styles.statLabel}>🥩 단백질</Text>
                <Text style={styles.statValue}>{selectedDateDetail.protein} g</Text>
              </View>

              <View style={styles.viewRowHeader}>
                <Text style={styles.statLabel}>🥑 지방</Text>
                <Text style={styles.statValue}>{selectedDateDetail.fat} g</Text>
              </View>
              <View style={styles.viewRowSub}>
                <Text style={styles.viewLabelSub}>- 포화지방</Text>
                <Text style={styles.viewValueSub}>{selectedDateDetail.saturated_fat || 0} g</Text>
              </View>
              <View style={styles.viewRowSubLast}>
                <Text style={styles.viewLabelSub}>- 트랜스지방</Text>
                <Text style={styles.viewValueSub}>{selectedDateDetail.trans_fat || 0} g</Text>
              </View>

              <View style={styles.simpleStatRow}>
                <Text style={styles.statLabel}>콜레스테롤</Text>
                <Text style={styles.statValue}>{selectedDateDetail.cholesterol || 0} mg</Text>
              </View>
              <View style={styles.simpleStatRow}>
                <Text style={styles.statLabel}>나트륨</Text>
                <Text style={styles.statValue}>{selectedDateDetail.sodium || 0} mg</Text>
              </View>
              <View style={styles.simpleStatRow}>
                <Text style={styles.statLabel}>칼륨</Text>
                <Text style={styles.statValue}>{selectedDateDetail.potassium || 0} mg</Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.hintText}>날짜를 터치하면 상세 정보가 표시됩니다.</Text>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, viewMode === 'weekly' ? styles.activeTab : null]} 
          onPress={() => setViewMode('weekly')}
        >
          <Text style={[styles.tabText, viewMode === 'weekly' ? styles.activeTabText : null]}>주간 통계</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, viewMode === 'monthly' ? styles.activeTab : null]} 
          onPress={() => setViewMode('monthly')}
        >
          <Text style={[styles.tabText, viewMode === 'monthly' ? styles.activeTabText : null]}>월간 통계</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : (
        viewMode === 'weekly' ? renderWeeklyView() : renderMonthlyView()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f8f8' },
  contentContainer: { flex: 1, padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#555' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
  tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#007bff' },
  tabText: { fontSize: 16, color: '#888', fontWeight: 'bold' },
  activeTabText: { color: '#007bff' },

  headerContainer: { alignItems: 'center', marginBottom: 15, marginTop: 5 },
  yearHeader: { fontSize: 16, color: '#888', marginBottom: 5 },
  dateNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 10 },
  dateHeader: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  navButton: { padding: 10 },
  navText: { fontSize: 16, color: '#555', fontWeight: '600' },

  summaryCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#888', marginBottom: 5 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  verticalLine: { width: 1, height: 40, backgroundColor: '#eee' },
  
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, alignSelf: 'flex-start' },
  
  nutrientBarContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20, marginBottom: 10 },
  nutrientBarItem: { alignItems: 'center', width: '30%' },
  nutrientBarLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 25 }, 
  barWrapper: { width: 20, height: 120, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10, position: 'relative' }, 
  barBackground: { width: 20, height: '100%', borderRadius: 10, overflow: 'hidden', position: 'absolute' },
  barFill: { width: '100%', borderRadius: 10 },
  warningIcon: { 
    position: 'absolute', 
    top: -25, 
  },
  nutrientBarValue: { fontSize: 11, color: '#555', marginBottom: 2 },
  nutrientBarPercent: { fontSize: 13, fontWeight: 'bold', color: '#555' },
  textRed: { color: '#F44336' },

  stackLegend: { flexDirection: 'row', marginBottom: 10, justifyContent: 'flex-end' },
  stackLegendText: { fontSize: 12, fontWeight: 'bold', marginLeft: 15 },
  noDataText: { color: '#aaa', marginTop: 20, marginBottom: 20, textAlign: 'center' },

  calendarContainer: { backgroundColor: '#fff', borderRadius: 15, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15, textAlign: 'center' }, 
  weekRow: { flexDirection: 'row', marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  dayHeader: { textAlign: 'center', fontWeight: 'bold', color: '#555', fontSize: 14 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { height: 75, padding: 2, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#f0f0f0', alignItems: 'center' },
  selectedDayCell: { backgroundColor: '#E3F2FD', borderColor: '#007bff', borderWidth: 1 }, 
  dayCellEmpty: { height: 75 },
  dayNumber: { fontSize: 12, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cellContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  cellPercent: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  noRecordText: { fontSize: 14, color: '#eee', marginTop: 15 },
  hintText: { textAlign: 'center', color: '#aaa', marginVertical: 20 },
  additionalNutrientContainerSingleLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0', 
  },
  additionalNutrientText: {
    fontSize: 14,
    color: '#777',
  },
  additionalNutrientValue: {
    fontWeight: 'bold',
    color: '#777',
  },
  simpleStatsContainer: {
    padding: 10, 
    alignItems: 'center',
    width: '100%', 
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
});

export default StatisticsScreen;