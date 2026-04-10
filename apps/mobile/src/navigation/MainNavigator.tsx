import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { MyBetsScreen } from '../screens/bets/MyBetsScreen';
import { RankingScreen } from '../screens/ranking/RankingScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  MyBets: undefined;
  Ranking: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary[700],
      tabBarInactiveTintColor: colors.gray[400],
      tabBarStyle: {
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.gray[200],
        paddingTop: 8,
        paddingBottom: 8,
        height: 60,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
    }}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Jogos' }} />
    <Tab.Screen name="Explore" component={ExploreScreen} options={{ tabBarLabel: 'Explorar' }} />
    <Tab.Screen name="MyBets" component={MyBetsScreen} options={{ tabBarLabel: 'Apostas' }} />
    <Tab.Screen name="Ranking" component={RankingScreen} options={{ tabBarLabel: 'Ranking' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Perfil' }} />
  </Tab.Navigator>
);
