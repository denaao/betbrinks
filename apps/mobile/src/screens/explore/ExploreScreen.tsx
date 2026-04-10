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

interface League {
  id: number;
  name: string;
  logo: string | null;
  fixtureCount: number;
}

interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  startAt: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  markets: any[];
}

export const ExploreScreen: React.FC = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeagues = async () => {
    try {
      const { data } = await api.get('/odds/leagues');
      setLeagues(data.data || data || []);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFixtures = async () => {
    setLoadingFixtures(true);
    try {
      const { data } = await api.get('/odds/fixtures');
      const allFixtures = data.data || data || [];
      if (selectedLeague) {
        setFixtures(allFixtures.filter((f: any) =>
          f.leagueName?.includes(leagues.find((l) => l.id === selectedLeague)?.name || ''),
        ));
      } else {
        setFixtures(allFixtures);
      }
    } catch {
      setFixtures([]);
    } finally {
      setLoadingFixtures(false);
    }
  };

  useFocusEffect(useCallback(() => { loadLeagues(); }, []));

  useFocusEffect(useCallback(() => {
    loadFixtures();
  }, [selectedLeague]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLeagues(), loadFixtures()]);
    setRefreshing(false);
  };

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
        <Text style={styles.headerTitle}>Explorar</Text>
        <Text style={styles.headerSubtitle}>Ligas e jogos disponiveis</Text>
      </View>

      {/* League Filter */}
      <FlatList
        data={[{ id: null, name: 'Todas', fixtureCount: 0 }, ...leagues] as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.leagueList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.leagueChip, selectedLeague === item.id && styles.leagueChipActive]}
            onPress={() => setSelectedLeague(item.id)}
          >
            <Text style={[styles.leagueChipText, selectedLeague === item.id && styles.leagueChipTextActive]}>
              {item.name}
            </Text>
            {item.fixtureCount > 0 && (
              <View style={styles.chipBadge}>
                <Text style={styles.chipBadgeText}>{item.fixtureCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Fixtures */}
      {loadingFixtures ? (
        <ActivityIndicator style={styles.fixtureLoader} color={colors.primary[700]} />
      ) : (
        <FlatList
          data={fixtures}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.fixtureList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fixtureCard} activeOpacity={0.7}>
              <Text style={styles.fixtureLeague} numberOfLines={1}>{item.leagueName}</Text>
              <View style={styles.fixtureRow}>
                <Text style={styles.fixtureTeam} numberOfLines={1}>{item.homeTeam}</Text>
                <Text style={styles.fixtureTime}>{formatTime(item.startAt)}</Text>
                <Text style={[styles.fixtureTeam, styles.fixtureTeamRight]} numberOfLines={1}>{item.awayTeam}</Text>
              </View>
              {item.markets.length > 0 && (
                <View style={styles.quickOdds}>
                  {item.markets[0].odds.slice(0, 3).map((odd: any) => (
                    <View key={odd.id} style={styles.quickOddItem}>
                      <Text style={styles.quickOddName}>{odd.name}</Text>
                      <Text style={styles.quickOddValue}>{odd.value.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nenhum jogo encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Os jogos aparecerao aqui quando o sistema sincronizar com a API-Football.
              </Text>
            </View>
          }
        />
      )}
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
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },

  leagueList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  leagueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing.sm,
  },
  leagueChipActive: { backgroundColor: colors.primary[700] },
  leagueChipText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  leagueChipTextActive: { color: colors.white },
  chipBadge: {
    marginLeft: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },

  fixtureLoader: { marginTop: spacing['4xl'] },
  fixtureList: { padding: spacing.lg, paddingBottom: spacing['4xl'] },

  fixtureCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  fixtureLeague: { fontSize: 11, fontWeight: '600', color: colors.gray[500], marginBottom: spacing.sm },
  fixtureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fixtureTeam: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text.primary },
  fixtureTeamRight: { textAlign: 'right' },
  fixtureTime: {
    fontSize: 14, fontWeight: '700', color: colors.primary[700],
    paddingHorizontal: spacing.md,
  },

  quickOdds: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: spacing.sm,
  },
  quickOddItem: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  quickOddName: { fontSize: 10, fontWeight: '600', color: colors.gray[500], marginBottom: 2 },
  quickOddValue: { fontSize: 15, fontWeight: '700', color: colors.text.primary },

  emptyState: { alignItems: 'center', paddingVertical: spacing['6xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: 14, color: colors.gray[400], textAlign: 'center', paddingHorizontal: spacing['2xl'] },
});
