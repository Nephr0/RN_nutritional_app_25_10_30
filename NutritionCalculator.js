// ... (import 및 state 설정 부분은 동일)
import { supabase } from './supabaseClient';

// ⭐️ 1. App.js로부터 'session' prop 받기
const NutritionCalculator = ({ session }) => { 
  // ... (state들)
  
  const saveUserDataToSupabase = async (userData) => {
    setIsLoading(true);
    try {
      // ⭐️ 2. userData 객체에 user_id 추가
      // session.user.id가 현재 로그인한 사용자의 고유 ID입니다.
      const dataToSave = {
        ...userData,
        user_id: session.user.id 
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert([dataToSave]); // user_id가 포함된 객체 전송

      if (error) throw error;

      console.log('Supabase 저장 성공:', data);
      alert('정보가 성공적으로 저장되었습니다!');

    } catch (error) {
      console.error('Supabase 저장 중 오류:', error.message);
      alert(`저장에 실패했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGoalCalories = () => {
    // ... (계산 로직 동일)

    const userData = {
      gender: gender,
      age: parseInt(age),
      height: parseFloat(height),
      current_weight: parseFloat(currentWeight),
      goal_weight: parseFloat(goalWeight),
      activity_level: activityLevel,
      bmr: parseFloat(bmr),
      tdee: parseFloat(tdee),
      goal_calories: parseFloat(goalCalories),
      // ⭐️ 3. user_id는 saveUserDataToSupabase 함수에서 추가되므로 여기선 제외
    };
    
    // ... (State 설정)
    
    saveUserDataToSupabase(userData);
  };

  return (
    // ... (JSX 렌더링 부분 동일)
    // ⭐️ (선택 사항) 로그아웃 버튼 추가
    <ScrollView style={styles.container}>
      {/* ... (모든 입력 필드 및 계산 버튼) ... */}
      
      {/* <Button 
        title="로그아웃" 
        onPress={() => supabase.auth.signOut()} 
        color="red"
      /> 
      */}
    </ScrollView>
  );
};

// ... (스타일 시트 동일)

export default NutritionCalculator;