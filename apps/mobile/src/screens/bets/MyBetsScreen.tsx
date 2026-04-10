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
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface Bet {
  id: number;
  fixtureId: number;
  fixture: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    startAt: string;
    status: string;
  };
  marketType: string;
  oddName: string;
  oddValue: number;
  amount: number;
  potentialReturn: number;
  status: string;
  createdAt: string;
  settledAt: string | null;
}

type TabType = 'active' | 'history';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  WON: 'Ganha',
  LOST: 'Perdida',
  VOID: 'Cancelada',
  CASHOUT: 'Cashout',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: colors.warning.main,
  WON: colors.success.main,
  LOST: colors.error.main,
  VOID: colors.gray[400],
  CASHOUT: colors.info.main,
};

const MARKET_LABELS: Record<string, string> = {
  MATCH_WINNER: '1x2',
  OVER_UNDER_25: 'Gols +/- 2.5',
  BOTH_TEAMS_SCORE: 'Ambas Marcam',
};

export const MyBetsScreen: React.FC = () => {
  const [tab, setTab] = useState<TabType>('active');
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [historyBets, setHistoryBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBets = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/bets/active'),
        api.get('/bets/history?limit=50'),
      ]);
      setActiveBets(activeRes.data.data || activeRes.data || []);
      const histData = historyRes.data.data?.data || historyRes.data.data || [];
      setHistoryBets(histData);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBets();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBets();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const currentBets = tab === 'active' ? activeBets : historyBets;

  const renderBet = ({ item }: { item: Bet }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.gray[400];

    return (
      <View style={styles.betCard}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[item.status]}
          </Text>
        </View>

        {/* Match Info */}
        <Text style={styles.matchTeams}>
          {item.fixture.homeTeam} vs {item.fixture.awayTeam}
        </Text>
        <Text style={styles.league}>{item.fixture.league}</Text>

        {/* Bet Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{MARKET_LABELS[item.marketType]}</Text>
            <Text style={styles.detailValue}>{item.oddName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Odd</Text>
            <Text style={styles.detailValue}>{item.oddValue.toFixed(2)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Apostado</Text>
            <Text style={styles.detailValue}>{item.amount}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Retorno</Text>
            <Text style={[styles.detailValue, item.status === 'WON' && styles.wonValue]}>
              {item.potentialReturn}
            </Text>
          </View>
        </View>

        {/* Date */}
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
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
        <Text style={styles.headerTitle}>Minhas Apostas</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Ativas ({activeBets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            Historico ({historyBets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bet Stats (history tab) */}
      {tab === 'history' && historyBets.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {historyBets.filter((b) => b.status === 'WON').length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.success.main }]}>Ganhas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {historyBets.filter((b) => b.status === 'LOST').length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.error.main }]}>Perdidas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {historyBets.length > 0
                ? Math.round((historyBets.filter((b) => b.status === 'WON').length / historyBets.length) * 100)
                : 0}%
            </Text>
            <Text style={styles.statLabel}>Taxa</Text>
          </View>
        </View>
      )}

      {/* Bets List */}
      <FlatList
        data={currentBets}
        renderItem={renderBet}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'Nenhuma aposta ativa' : 'Nenhuma aposta no historico'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'active'
                ? 'Faca sua primeira aposta nos jogos disponveis!'
                : 'Suas apostas encerradas aparecerao aqui.'}
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
    paddingBottom: spacing.xl,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.white },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
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
  tabText: { fontSize: 15, fontWeight: '600', color: colors.gray[400] },
  tabTextActive: { color: colors.primary[700] },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text.primary },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, marginTop: spacing.xs },

  listContent: { padding: spacing.lg, paddingBottom: spacing['4xl'] },

  betCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
    marginBottom: spacing.sm,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  matchTeams: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  league: { fontSize: 12, color: colors.gray[500], marginTop: spacing.xs, marginBottom: spacing.md },

  detailsRow: { flexDirection: 'row', gap: spacing.sm },
  detailItem: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  detailLabel: { fontSize: 10, fontWeight: '600', color: colors.gray[400], marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  wonValue: { color: colors.success.main },

  dateText: { fontSize: 11, color: colors.gray[400], marginTop: spacing.sm, textAlign: 'right' },

  emptyState: { alignItems: 'center', paddingVertical: spacing['6xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: 14, color: colors.gray[400], textAlign: 'center', paddingHorizontal: spacing['2xl'] },
});
