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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface Fixture {
  id: number;
  apiFootballId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueName: string;
  leagueCountry: string;
  status: string;
  startTime: string;
  homeScore: number | null;
  awayScore: number | null;
}

export const HomeScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFixtures = async () => {
    try {
      const { data } = await api.get('/odds/fixtures');
      setFixtures(data.data || []);
    } catch {
      // API not ready yet - show empty state
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFixtures();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFixtures();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const isLive = (status: string) => {
    return ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'NS': return 'A iniciar';
      case '1H': return '1o Tempo';
      case 'HT': return 'Intervalo';
      case '2H': return '2o Tempo';
      case 'ET': return 'Prorrogacao';
      case 'P': return 'Penaltis';
      case 'FT': return 'Encerrado';
      case 'LIVE': return 'Ao Vivo';
      default: return status;
    }
  };

  const renderFixture = ({ item }: { item: Fixture }) => {
    const live = isLive(item.status);

    return (
      <TouchableOpacity style={styles.fixtureCard} activeOpacity={0.7}>
        {/* League Header */}
        <View style={styles.leagueRow}>
          <Text style={styles.leagueName} numberOfLines={1}>
            {item.leagueCountry} - {item.leagueName}
          </Text>
          {live ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>AO VIVO</Text>
            </View>
          ) : (
            <Text style={styles.timeText}>{formatTime(item.startTime)}</Text>
          )}
        </View>

        {/* Teams */}
        <View style={styles.teamsRow}>
          <View style={styles.teamColumn}>
            <View style={styles.teamLogoPlaceholder}>
              <Text style={styles.teamInitial}>{item.homeTeam[0]}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={2}>{item.homeTeam}</Text>
          </View>

          <View style={styles.scoreColumn}>
            {item.homeScore !== null ? (
              <Text style={[styles.score, live && styles.scoreLive]}>
                {item.homeScore} - {item.awayScore}
              </Text>
            ) : (
              <Text style={styles.vsText}>VS</Text>
            )}
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>

          <View style={styles.teamColumn}>
            <View style={styles.teamLogoPlaceholder}>
              <Text style={styles.teamInitial}>{item.awayTeam[0]}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={2}>{item.awayTeam}</Text>
          </View>
        </View>

        {/* Bet CTA */}
        {item.status === 'NS' && (
          <View style={styles.betRow}>
            <Text style={styles.betCta}>Apostar neste jogo</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[700]} />
        <Text style={styles.loadingText}>Carregando jogos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || 'Jogador'}!</Text>
          <Text style={styles.headerSubtitle}>Jogos de hoje</Text>
        </View>
      </View>

      {/* Fixtures List */}
      <FlatList
        data={fixtures}
        renderItem={renderFixture}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhum jogo no momento</Text>
            <Text style={styles.emptySubtitle}>
              Os jogos aparecerao aqui quando o modulo de odds estiver integrado com a API-Football.
              {'\n\n'}Enquanto isso, explore o app!
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    backgroundColor: colors.primary[700],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  fixtureCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  leagueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  leagueName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    flex: 1,
    marginRight: spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.live,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  teamInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[500],
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  scoreColumn: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  score: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
  },
  scoreLive: {
    color: colors.live,
  },
  vsText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[300],
  },
  statusText: {
    fontSize: 11,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  betRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    alignItems: 'center',
  },
  betCta: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
    paddingHorizontal: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
