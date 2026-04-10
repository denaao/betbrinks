import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface Market {
  id: number;
  type: string;
  status: string;
  odds: Array<{ id: number; name: string; value: number }>;
}

interface FixtureDetail {
  id: number;
  leagueName: string;
  homeTeam: string;
  homeLogo: string | null;
  awayTeam: string;
  awayLogo: string | null;
  startAt: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  markets: Market[];
}

const MARKET_LABELS: Record<string, string> = {
  MATCH_WINNER: 'Resultado Final (1x2)',
  OVER_UNDER_25: 'Gols Acima/Abaixo 2.5',
  BOTH_TEAMS_SCORE: 'Ambas Marcam',
};

export const MatchDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { fixtureId } = route.params;
  const [fixture, setFixture] = useState<FixtureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOdd, setSelectedOdd] = useState<{ oddId: number; name: string; value: number; marketType: string } | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [showBetModal, setShowBetModal] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    loadFixture();
  }, []);

  const loadFixture = async () => {
    try {
      const { data } = await api.get(`/odds/fixtures/${fixtureId}`);
      setFixture(data.data || data);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel carregar o jogo.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOdd = (odd: { id: number; name: string; value: number }, marketType: string) => {
    setSelectedOdd({ oddId: odd.id, name: odd.name, value: odd.value, marketType });
    setBetAmount('');
    setShowBetModal(true);
  };

  const handlePlaceBet = async () => {
    if (!selectedOdd || !betAmount) return;

    const amount = parseInt(betAmount);
    if (isNaN(amount) || amount < 10) {
      Alert.alert('Erro', 'Aposta minima: 10 pontos');
      return;
    }
    if (amount > 10000) {
      Alert.alert('Erro', 'Aposta maxima: 10.000 pontos');
      return;
    }

    setPlacing(true);
    try {
      await api.post('/bets', {
        fixtureId,
        oddId: selectedOdd.oddId,
        amount,
      });

      const potentialReturn = Math.floor(amount * selectedOdd.value);
      Alert.alert(
        'Aposta feita!',
        `${selectedOdd.name} @${selectedOdd.value.toFixed(2)}\n${amount} pontos apostados\nRetorno potencial: ${potentialReturn} pontos`,
      );
      setShowBetModal(false);
      setSelectedOdd(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao fazer aposta.';
      Alert.alert('Erro', msg);
    } finally {
      setPlacing(false);
    }
  };

  const potentialReturn = selectedOdd && betAmount
    ? Math.floor(parseInt(betAmount || '0') * selectedOdd.value)
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[700]} />
      </View>
    );
  }

  if (!fixture) return null;

  const isLive = ['FIRST_HALF', 'HALFTIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'].includes(fixture.status);
  const canBet = fixture.status === 'NOT_STARTED';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.leagueName}>{fixture.leagueName}</Text>

          {/* Score/VS */}
          <View style={styles.matchHeader}>
            <View style={styles.teamCol}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamInitial}>{fixture.homeTeam[0]}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={2}>{fixture.homeTeam}</Text>
            </View>

            <View style={styles.scoreCol}>
              {fixture.scoreHome !== null ? (
                <Text style={[styles.score, isLive && styles.scoreLive]}>
                  {fixture.scoreHome} - {fixture.scoreAway}
                </Text>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
              <Text style={styles.matchTime}>
                {new Date(fixture.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>AO VIVO</Text>
                </View>
              )}
            </View>

            <View style={styles.teamCol}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamInitial}>{fixture.awayTeam[0]}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={2}>{fixture.awayTeam}</Text>
            </View>
          </View>
        </View>

        {/* Markets */}
        {fixture.markets.length > 0 ? (
          fixture.markets.map((market) => (
            <View key={market.id} style={styles.marketCard}>
              <Text style={styles.marketTitle}>
                {MARKET_LABELS[market.type] || market.type}
              </Text>
              {market.status === 'settled' && (
                <Text style={styles.settledLabel}>Encerrado</Text>
              )}

              <View style={styles.oddsRow}>
                {market.odds.map((odd) => (
                  <TouchableOpacity
                    key={odd.id}
                    style={[
                      styles.oddButton,
                      !canBet && styles.oddDisabled,
                      selectedOdd?.oddId === odd.id && styles.oddSelected,
                    ]}
                    onPress={() => canBet && handleSelectOdd(odd, market.type)}
                    disabled={!canBet}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.oddName}>{odd.name}</Text>
                    <Text style={[
                      styles.oddValue,
                      selectedOdd?.oddId === odd.id && styles.oddValueSelected,
                    ]}>
                      {odd.value.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noMarkets}>
            <Text style={styles.noMarketsText}>Odds ainda nao disponiveis para este jogo.</Text>
          </View>
        )}
      </ScrollView>

      {/* Bet Modal */}
      <Modal visible={showBetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fazer Aposta</Text>

            <View style={styles.modalSelection}>
              <Text style={styles.modalLabel}>{MARKET_LABELS[selectedOdd?.marketType || '']}</Text>
              <View style={styles.modalOddRow}>
                <Text style={styles.modalOddName}>{selectedOdd?.name}</Text>
                <Text style={styles.modalOddValue}>@{selectedOdd?.value.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Quantos pontos?</Text>
            <TextInput
              style={styles.amountInput}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="number-pad"
              placeholder="Min 10 - Max 10.000"
              placeholderTextColor={colors.gray[400]}
            />

            {potentialReturn > 0 && (
              <View style={styles.returnRow}>
                <Text style={styles.returnLabel}>Retorno potencial:</Text>
                <Text style={styles.returnValue}>{potentialReturn.toLocaleString('pt-BR')} pts</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowBetModal(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, placing && styles.confirmDisabled]}
                onPress={handlePlaceBet}
                disabled={placing}
              >
                {placing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>Apostar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  scrollContent: { paddingBottom: spacing['4xl'] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.secondary },

  header: {
    backgroundColor: colors.primary[700],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  backButton: { marginBottom: spacing.md },
  backText: { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  leagueName: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: spacing.lg },

  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamCol: { flex: 1, alignItems: 'center' },
  teamLogo: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  teamInitial: { fontSize: 22, fontWeight: '700', color: colors.white },
  teamName: { fontSize: 14, fontWeight: '600', color: colors.white, textAlign: 'center' },
  scoreCol: { alignItems: 'center', paddingHorizontal: spacing.lg },
  score: { fontSize: 32, fontWeight: '800', color: colors.white },
  scoreLive: { color: '#FCA5A5' },
  vsText: { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  matchTime: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },
  liveBadge: {
    marginTop: spacing.sm, backgroundColor: colors.error.main,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  liveText: { fontSize: 10, fontWeight: '800', color: colors.white },

  marketCard: {
    margin: spacing.lg, marginBottom: 0,
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.md,
  },
  marketTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  settledLabel: { fontSize: 12, fontWeight: '600', color: colors.gray[400], marginBottom: spacing.sm },
  oddsRow: { flexDirection: 'row', gap: spacing.sm },
  oddButton: {
    flex: 1, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: borderRadius.md, alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  oddDisabled: { opacity: 0.5 },
  oddSelected: {
    borderColor: colors.primary[700],
    backgroundColor: colors.primary[50],
  },
  oddName: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.xs },
  oddValue: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
  oddValueSelected: { color: colors.primary[700] },

  noMarkets: {
    margin: spacing.lg, padding: spacing['3xl'],
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    alignItems: 'center', ...shadow.sm,
  },
  noMarketsText: { fontSize: 15, color: colors.gray[400], textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.xl },
  modalSelection: {
    backgroundColor: colors.gray[50], borderRadius: borderRadius.md,
    padding: spacing.lg, marginBottom: spacing.xl,
  },
  modalLabel: { fontSize: 12, fontWeight: '600', color: colors.gray[500], marginBottom: spacing.sm },
  modalOddRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOddName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  modalOddValue: { fontSize: 18, fontWeight: '800', color: colors.primary[700] },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm },
  amountInput: {
    height: 52, borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: borderRadius.md, paddingHorizontal: spacing.lg,
    fontSize: 20, fontWeight: '700', color: colors.text.primary,
    backgroundColor: colors.gray[50], textAlign: 'center',
  },
  returnRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray[100],
  },
  returnLabel: { fontSize: 14, color: colors.text.secondary },
  returnValue: { fontSize: 16, fontWeight: '800', color: colors.success.main },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelButton: {
    flex: 1, height: 48, borderWidth: 1.5, borderColor: colors.gray[300],
    borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  confirmButton: {
    flex: 2, height: 48, backgroundColor: colors.primary[700],
    borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.7 },
  confirmText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
