// StatisticsScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, ScrollView, Button, Alert } from 'react-native';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryTheme, VictoryLabel } from 'victory-native';
import { Svg } from 'react-native-svg';
import { supabase } from './supabaseClient';
import { getFormattedDate } from './MealLogger';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 50; 

const StatisticsScreen = ({ session }) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [goalCalories, setGoalCalories] = useState(0);
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateRangeText, setDateRangeText] = useState('');

  useEffect(() => {
    if (session) {
      fetchStatisticsData();
    }
  }, [session, weekOffset]);

  const fetchStatisticsData = async () => {
    setLoading(true);
    try {
      // 1. 사용자 프로필에서 목표 칼로리 가져오기
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('goal_calories')
        .eq('user_id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      if (profileData) {
        setGoalCalories(profileData.goal_calories || 0);
      }

      // 2. weekOffset을 기준으로 날짜 계산
      const today = new Date();
      today.setDate(today.getDate() - (weekOffset * 7));
      
      const periodEndDate = new Date(today);
      const periodStartDate = new Date(today);
      periodStartDate.setDate(today.getDate() - 6);

      setDateRangeText(`${getFormattedDate(periodStartDate)} ~ ${getFormattedDate(periodEndDate)}`);

      // 3. 계산된 기간의 식단 기록 가져오기
      const { data: logsData, error: logsError } = await supabase
        .from('meal_logs')
        .select('date, calories')
        .eq('user_id', session.user.id)
        .gte('date', getFormattedDate(periodStartDate))
        .lte('date', getFormattedDate(periodEndDate))
        .order('date', { ascending: true });

      if (logsError) throw logsError;

      // 4. 날짜별 칼로리 합계 계산
      const dailyCaloriesMap = new Map();
      logsData.forEach(log => {
        const date = log.date;
        dailyCaloriesMap.set(date, (dailyCaloriesMap.get(date) || 0) + log.calories);
      });

      // 5. 차트 데이터 형식으로 가공
      const formattedChartData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(periodStartDate);
        date.setDate(periodStartDate.getDate() + i);
        const dateString = getFormattedDate(date);
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
        const calories = dailyCaloriesMap.get(dateString) || 0;

        formattedChartData.push({
          x: dayOfWeek,
          y: calories,
          label: `${calories}`
        });
      }
      setChartData(formattedChartData);

    } catch (error) {
      console.error('통계 데이터 로딩 중 오류:', error);
      Alert.alert('오류', '통계 데이터를 불러오는 데 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrevWeek = () => {
    setWeekOffset(weekOffset + 1);
  };
  
  const handleNextWeek = () => {
    setWeekOffset(weekOffset - 1);
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>통계 데이터를 불러오는 중...</Text>
      </View>
    );
  }

  // 차트 Y축 계산 로직
  const maxEaten = Math.max(...chartData.map(d => d.y));
  const maxDomainValue = Math.max(maxEaten, goalCalories) * 1.2;
  const maxDomain = maxDomainValue < 1000 ? 1000 : maxDomainValue;
  
  // ⭐️ [수정] Y축에 표시할 눈금 (0만 포함, 목표 칼로리는 목표 선에서 별도로 처리)
  const yAxisTickValues = [0].filter(val => val >= 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>주간 칼로리 섭취 통계</Text>
      
      <View style={styles.weekNavigator}>
        <Button title="◀ 이전 주" onPress={handlePrevWeek} />
        <Text style={styles.dateRangeText}>{dateRangeText}</Text>
        <Button title="다음 주 ▶" onPress={handleNextWeek} disabled={weekOffset === 0} />
      </View>

      <View style={styles.chartContainer}>
        {chartData.length > 0 || goalCalories > 0 ? (
          <Svg width={chartWidth} height={300}>
            <VictoryChart
              domainPadding={{ x: 30 }}
              theme={VictoryTheme.material}
              height={300}
              width={chartWidth}
              padding={{ top: 30, bottom: 50, left: 60, right: 30 }}
              domain={{ y: [0, maxDomain] }}
            >
              {/* 목표 칼로리 선 */}
              {goalCalories > 0 && (
                <VictoryAxis
                  dependentAxis
                  standalone={false}
                  tickValues={[goalCalories]} // ⭐️ 목표 칼로리 위치에만 라벨
                  tickFormat={[`${goalCalories}kcal`]} // ⭐️ 목표 칼로리 라벨
                  tickLabelComponent={<VictoryLabel dx={0} textAnchor="end" />}
                  style={{
                    grid: { stroke: "#ff0000", strokeWidth: 1, strokeDasharray: "4, 4" },
                    tickLabels: { fill: "#ff0000", fontSize: 10 },
                  }}
                />
              )}
              
              <VictoryAxis
                // X축 (요일)
                style={{
                  axis: { stroke: "#756f6a" },
                  tickLabels: { fontSize: 12, padding: 5, angle: 0 },
                }}
              />
              <VictoryAxis
                dependentAxis
                // Y축 (칼로리)
                tickFormat={(tick) => `${tick}`}
                style={{
                  axis: { stroke: "#756f6a" },
                  tickLabels: { fill: "#000000", fontSize: 10, padding: 5 }, // ⭐️ 일반 눈금 라벨은 검은색
                  grid: { stroke: "lightgray", strokeDasharray: "5, 5" }
                }}
                tickValues={yAxisTickValues} // ⭐️ [수정] 0만 포함된 yAxisTickValues 사용
              />
              <VictoryBar
                data={chartData}
                x="x"
                y="y"
                labels={({ datum }) => datum.label}
                labelComponent={<VictoryLabel dy={-5} />}
                style={{
                  data: { fill: ({ datum }) => (datum.y > goalCalories && goalCalories > 0 ? "#FF5252" : "#007bff") },
                  labels: { fontSize: 10, fill: "black" }
                }}
              />
            </VictoryChart>
          </Svg>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>해당 기간의 식단 기록이 없습니다.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  weekNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noDataContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 18,
    color: '#777',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  noDataSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default StatisticsScreen;