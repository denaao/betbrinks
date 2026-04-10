import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../stores/useAuthStore';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

type RouteParams = RouteProp<AuthStackParamList, 'VerifyPhone'>;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export const VerifyPhoneScreen: React.FC = () => {
  const route = useRoute<RouteParams>();
  const { phone } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChangeText = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === CODE_LENGTH - 1 && newCode.every((d) => d)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const fullCode = otpCode || code.join('');
    if (fullCode.length !== CODE_LENGTH) {
      Alert.alert('Erro', 'Digite o codigo completo de 6 digitos.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-phone', {
        phone,
        code: fullCode,
      });

      const res = data.data;
      await setAuth(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Codigo invalido. Tente novamente.';
      Alert.alert('Erro', msg);
      // Clear code on error
      setCode(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    try {
      await api.post('/auth/login', { email: '', password: '' }); // Triggers OTP resend
      Alert.alert('Codigo reenviado', 'Um novo codigo foi enviado para seu telefone.');
      setResendTimer(RESEND_COOLDOWN);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel reenviar o codigo.');
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone.replace(/(\+55)(\d{2})(\d{5})(\d{4})/, '+55 ($2) $3-$4');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>betbrinks</Text>
          <Text style={styles.title}>Verificar Telefone</Text>
          <Text style={styles.subtitle}>
            Enviamos um codigo de 6 digitos para{'\n'}
            <Text style={styles.phoneText}>{maskedPhone}</Text>
          </Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
              ]}
              value={digit}
              onChangeText={(t) => handleChangeText(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Verificar</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>
              Reenviar codigo em {resendTimer}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? 'Reenviando...' : 'Reenviar codigo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background.primary },
  container: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary[700],
    letterSpacing: -1,
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneText: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing['3xl'],
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    backgroundColor: colors.gray[50],
  },
  codeInputFilled: {
    borderColor: colors.primary[700],
    backgroundColor: colors.primary[50],
  },
  button: {
    height: 52,
    backgroundColor: colors.primary[700],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  resendTimer: {
    fontSize: 14,
    color: colors.gray[400],
  },
  resendLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
