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
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadow } from '../../theme/spacing';

interface DiamondPackage {
  id: string;
  name: string;
  diamonds: number;
  bonusPoints: number;
  priceBRL: number;
  priceFormatted: string;
}

interface PointBalance {
  points: number;
  diamonds: number;
}

const PACKAGE_COLORS: Record<string, { bg: string; accent: string }> = {
  starter: { bg: '#EFF6FF', accent: '#3B82F6' },
  popular: { bg: '#F0FDF4', accent: '#10B981' },
  pro: { bg: '#FDF4FF', accent: '#A855F7' },
  vip: { bg: '#FFFBEB', accent: '#F59E0B' },
};

const PACKAGE_ICONS: Record<string, string> = {
  starter: '*',
  popular: '**',
  pro: '***',
  vip: '****',
};

export const DiamondStoreScreen: React.FC = () => {
  const [packages, setPackages] = useState<DiamondPackage[]>([]);
  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [pkgRes, balRes] = await Promise.all([
        api.get('/diamonds/packages'),
        api.get('/points/balance'),
      ]);
      setPackages(pkgRes.data.data || pkgRes.data || []);
      setBalance(balRes.data.data || balRes.data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePurchase = (pkg: DiamondPackage) => {
    Alert.alert(
      `Comprar ${pkg.name}`,
      `${pkg.diamonds} diamantes + ${pkg.bonusPoints} pontos bonus\nPreco: ${pkg.priceFormatted}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: () => executePurchase(pkg),
        },
      ],
    );
  };

  const executePurchase = async (pkg: DiamondPackage) => {
    setPurchasing(pkg.id);
    try {
      // In production, this would go through Google Play / App Store IAP
      // For dev, simulate with a mock receipt
      const { data } = await api.post('/diamonds/purchase', {
        packageId: pkg.id,
        platform: 'google_play',
        storeReceipt: `DEV_RECEIPT_${Date.now()}`,
      });

      const res = data.data || data;
      Alert.alert('Compra realizada!', res.message);
      await loadData(); // Refresh balance
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao processar compra.';
      Alert.alert('Erro', msg);
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[700]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[700]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Loja de Diamantes</Text>
        <Text style={styles.headerSubtitle}>
          Compre diamantes e converta em pontos para apostar!
        </Text>
      </View>

      {/* Current Balance */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceIcon}>*</Text>
          <Text style={styles.balanceValue}>{balance?.diamonds?.toLocaleString('pt-BR') ?? '0'}</Text>
          <Text style={styles.balanceLabel}>Diamantes</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={[styles.balanceIcon, { color: colors.points }]}>*</Text>
          <Text style={styles.balanceValue}>{balance?.points?.toLocaleString('pt-BR') ?? '0'}</Text>
          <Text style={styles.balanceLabel}>Pontos</Text>
        </View>
      </View>

      {/* Conversion Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          1 diamante = 5 pontos. Converta na aba Perfil!
        </Text>
      </View>

      {/* Packages */}
      <Text style={styles.sectionTitle}>Escolha seu pacote</Text>

      {packages.map((pkg) => {
        const colorScheme = PACKAGE_COLORS[pkg.id] || PACKAGE_COLORS.starter;
        const icon = PACKAGE_ICONS[pkg.id] || '*';
        const isBuying = purchasing === pkg.id;

        return (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.packageCard, { backgroundColor: colorScheme.bg }]}
            onPress={() => handlePurchase(pkg)}
            disabled={!!purchasing}
            activeOpacity={0.8}
          >
            <View style={styles.packageLeft}>
              <View style={[styles.packageIcon, { backgroundColor: colorScheme.accent + '20' }]}>
                <Text style={[styles.packageIconText, { color: colorScheme.accent }]}>{icon}</Text>
              </View>
              <View style={styles.packageInfo}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageDiamonds}>{pkg.diamonds} diamantes</Text>
                {pkg.bonusPoints > 0 && (
                  <Text style={[styles.packageBonus, { color: colorScheme.accent }]}>
                    +{pkg.bonusPoints} pontos bonus
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.packageRight}>
              {isBuying ? (
                <ActivityIndicator color={colorScheme.accent} />
              ) : (
                <View style={[styles.priceButton, { backgroundColor: colorScheme.accent }]}>
                  <Text style={styles.priceText}>{pkg.priceFormatted}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Footer */}
      <Text style={styles.footer}>
        Diamantes sao apenas para uso recreativo no app.{'\n'}
        Nao possuem valor monetario real.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { paddingBottom: spacing['4xl'] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.secondary },

  header: {
    backgroundColor: colors.primary[700],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.white },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },

  balanceCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadow.md,
  },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceDivider: { width: 1, backgroundColor: colors.gray[200] },
  balanceIcon: { fontSize: 18, color: colors.diamond, marginBottom: spacing.xs },
  balanceValue: { fontSize: 24, fontWeight: '800', color: colors.text.primary },
  balanceLabel: { fontSize: 12, color: colors.text.secondary, marginTop: spacing.xs },

  infoCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[700],
  },
  infoText: { fontSize: 13, color: colors.primary[800], fontWeight: '500' },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  packageLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  packageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  packageIconText: { fontSize: 20, fontWeight: '800' },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  packageDiamonds: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  packageBonus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  packageRight: { marginLeft: spacing.md },
  priceButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  priceText: { fontSize: 14, fontWeight: '700', color: colors.white },

  footer: {
    fontSize: 12,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    lineHeight: 18,
  },
});
