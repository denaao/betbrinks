import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface RankingEntry {
  position: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  points: number;
  wonBets: number;
  winRate: number;
}

interface UserStats {
  globalPosition: number | null;
  weeklyPosition: number | null;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
}

type TabType = 'global' | 'weekly' | 'monthly';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze

export const RankingScreen: React.FC = () => {
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabType>('global');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myStats, setMyStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRanking = async () => {
    try {
      const [rankRes, statsRes] = await Promise.all([
        api.get(`/ranking/${tab}`),
        api.get('/ranking/me'),
      ]);
      setRanking(rankRes.data.data || rankRes.data || []);
      setMyStats(statsRes.data.data || statsRes.data);
    } catch {
      setRanking([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadRanking(); }, [tab]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRanking();
    setRefreshing(false);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const renderRankItem = ({ item }: { item: RankingEntry }) => {
    const isMe = item.userId === currentUser?.id;
    const isTop3 = item.position <= 3;

    return (
      <View style={[styles.rankItem, isMe && styles.rankItemMe]}>
        {/* Position */}
        <View style={styles.positionCol}>
          {isTop3 ? (
            <View style={[styles.medal, { backgroundColor: MEDAL_COLORS[item.position - 1] }]}>
              <Text style={styles.medalText}>{item.position}</Text>
            </View>
          ) : (
            <Text style={styles.positionText}>{item.position}</Text>
          )}
        </View>

        {/* Avatar + Name */}
        <View style={styles.userCol}>
          <View style={[styles.avatar, isMe && styles.avatarMe]}>
            <Text style={[styles.avatarText, isMe && styles.avatarTextMe]}>
              {getInitials(item.name)}
            </Text>
          </View>
          <View style={styles.nameCol}>
            <Text style={[styles.userName, isMe && styles.userNameMe]} numberOfLines={1}>
              {item.name} {isMe ? '(voce)' : ''}
            </Text>
            <Text style={styles.userLevel}>Nivel {item.level}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCol}>
          <Text style={styles.pointsValue}>{item.points.toLocaleString('pt-BR')}</Text>
          <Text style={styles.winRateText}>{item.winRate}% taxa</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[700]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ranking</Text>

        {/* My Position Card */}
        {myStats && (
          <View style={styles.myCard}>
            <View style={styles.myCardRow}>
              <View style={styles.myCardItem}>
                <Text style={styles.myCardValue}>
                  {myStats.globalPosition ? `#${myStats.globalPosition}` : '-'}
                </Text>
                <Text style={styles.myCardLabel}>Global</Text>
              </View>
              <View style={styles.myCardDivider} />
              <View style={styles.myCardItem}>
                <Text style={styles.myCardValue}>
                  {myStats.weeklyPosition ? `#${myStats.weeklyPosition}` : '-'}
                </Text>
                <Text style={styles.myCardLabel}>Semanal</Text>
              </View>
              <View style={styles.myCardDivider} />
              <View style={styles.myCardItem}>
                <Text style={styles.myCardValue}>{myStats.winRate}%</Text>
                <Text style={styles.myCardLabel}>Taxa</Text>
              </View>
              <View style={styles.myCardDivider} />
              <View style={styles.myCardItem}>
                <Text style={styles.myCardValue}>{myStats.wonBets}</Text>
                <Text style={styles.myCardLabel}>Ganhas</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['global', 'weekly', 'monthly'] as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabButton, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); setLoading(true); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'global' ? 'Global' : t === 'weekly' ? 'Semanal' : 'Mensal'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ranking List */}
      <FlatList
        data={ranking}
        renderItem={renderRankItem}
        keyExtractor={(item) => `${item.userId}-${item.position}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhum jogador no ranking</Text>
            <Text style={styles.emptySubtitle}>
              Faca suas apostas para aparecer aqui!
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.secondary },

  header: {
    backgroundColor: colors.primary[700],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.lg },

  myCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  myCardRow: { flexDirection: 'row', alignItems: 'center' },
  myCardItem: { flex: 1, alignItems: 'center' },
  myCardDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  myCardValue: { fontSize: 18, fontWeight: '800', color: colors.white },
  myCardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary[700] },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.gray[400] },
  tabTextActive: { color: colors.primary[700] },

  listContent: { paddingVertical: spacing.sm },

  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  rankItemMe: {
    backgroundColor: colors.primary[50],
  },

  positionCol: { width: 40, alignItems: 'center' },
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: { fontSize: 13, fontWeight: '800', color: colors.white },
  positionText: { fontSize: 15, fontWeight: '700', color: colors.gray[500] },

  userCol: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarMe: { backgroundColor: colors.primary[700] },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.gray[600] },
  avatarTextMe: { color: colors.white },
  nameCol: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  userNameMe: { color: colors.primary[800] },
  userLevel: { fontSize: 11, color: colors.gray[400], marginTop: 1 },

  statsCol: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 15, fontWeight: '800', color: colors.text.primary },
  winRateText: { fontSize: 11, color: colors.gray[400], marginTop: 1 },

  emptyState: { alignItems: 'center', paddingVertical: spacing['6xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: 14, color: colors.gray[400], textAlign: 'center' },
});
