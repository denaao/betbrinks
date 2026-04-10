import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface PointBalance {
  points: number;
  diamonds: number;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export const ProfileScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [collectingBonus, setCollectingBonus] = useState(false);
  const [bonusCollected, setBonusCollected] = useState(false);

  const loadData = async () => {
    try {
      const [balanceRes, txRes, profileRes] = await Promise.all([
        api.get('/points/balance'),
        api.get('/points/transactions?limit=10'),
        api.get('/users/me'),
      ]);
      setBalance(balanceRes.data.data);
      setTransactions(txRes.data.data.data);
      setUser(profileRes.data.data);
    } catch {
      // Silently fail on refresh
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      setBonusCollected(false);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCollectBonus = async () => {
    setCollectingBonus(true);
    try {
      const { data } = await api.post('/points/daily-bonus');
      Alert.alert('Bonus coletado!', data.data.message);
      setBonusCollected(true);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao coletar bonus.';
      if (msg.includes('ja coletado')) {
        setBonusCollected(true);
      }
      Alert.alert('Aviso', msg);
    } finally {
      setCollectingBonus(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const getTransactionIcon = (type: string): string => {
    switch (type) {
      case 'DAILY_BONUS': return '+';
      case 'BET_PLACED': return '-';
      case 'BET_WON': return '+';
      case 'DIAMOND_CONVERSION': return '+';
      case 'INITIAL_BONUS': return '+';
      default: return '';
    }
  };

  const getTransactionColor = (amount: number): string => {
    return amount >= 0 ? colors.success.main : colors.error.main;
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />}
    >
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        {user?.isVerified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verificado</Text>
          </View>
        )}
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Meu Saldo</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceIcon}>*</Text>
            <Text style={styles.balanceValue}>
              {balance?.points?.toLocaleString('pt-BR') ?? '...'}
            </Text>
            <Text style={styles.balanceLabel}>Pontos</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceIcon, { color: colors.diamond }]}>*</Text>
            <Text style={styles.balanceValue}>
              {balance?.diamonds?.toLocaleString('pt-BR') ?? '0'}
            </Text>
            <Text style={styles.balanceLabel}>Diamantes</Text>
          </View>
        </View>
      </View>

      {/* Daily Bonus */}
      <TouchableOpacity
        style={[styles.bonusButton, bonusCollected && styles.bonusCollected]}
        onPress={handleCollectBonus}
        disabled={collectingBonus || bonusCollected}
        activeOpacity={0.8}
      >
        {collectingBonus ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.bonusText}>
              {bonusCollected ? 'Bonus ja coletado hoje' : 'Coletar Bonus Diario'}
            </Text>
            {!bonusCollected && (
              <Text style={styles.bonusSubtext}>+50 pontos gratis!</Text>
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historico Recente</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma transacao ainda</Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txItem}>
              <View style={styles.txLeft}>
                <Text style={styles.txDescription}>{tx.description}</Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>
              <Text style={[styles.txAmount, { color: getTransactionColor(tx.amount) }]}>
                {getTransactionIcon(tx.type)}{Math.abs(tx.amount).toLocaleString('pt-BR')}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { paddingBottom: spacing['4xl'] },
  profileCard: {
    backgroundColor: colors.primary[700],
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  verifiedBadge: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  balanceCard: {
    margin: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadow.md,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceIcon: {
    fontSize: 20,
    color: colors.points,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  balanceDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.gray[200],
  },
  bonusButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.success.main,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  bonusCollected: {
    backgroundColor: colors.gray[300],
  },
  bonusText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  bonusSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray[400],
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  txLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  txDate: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.error.main,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error.main,
  },
});
