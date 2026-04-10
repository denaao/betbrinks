import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!name.trim()) e.name = 'Informe seu nome';
    else if (name.trim().length < 3) e.name = 'Nome deve ter no minimo 3 caracteres';

    if (!email.trim()) e.email = 'Informe seu e-mail';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail invalido';

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) e.phone = 'Informe seu telefone';
    else if (phoneDigits.length < 10 || phoneDigits.length > 11) e.phone = 'Telefone invalido (DDD + numero)';

    if (!password) e.password = 'Informe uma senha';
    else if (password.length < 8) e.password = 'Senha deve ter no minimo 8 caracteres';

    if (!confirmPassword) e.confirmPassword = 'Confirme sua senha';
    else if (password !== confirmPassword) e.confirmPassword = 'As senhas nao coincidem';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);

    const phoneDigits = phone.replace(/\D/g, '');
    const formattedPhone = `+55${phoneDigits}`;

    try {
      await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: formattedPhone,
        password,
      });

      Alert.alert(
        'Conta criada!',
        'Enviamos um codigo de verificacao para seu telefone.',
        [{ text: 'OK', onPress: () => navigation.navigate('VerifyPhone', { phone: formattedPhone }) }],
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar conta. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>betbrinks</Text>
          <Text style={styles.tagline}>Crie sua conta e ganhe 1.000 pontos!</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Criar Conta</Text>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Seu nome"
              placeholderTextColor={colors.gray[400]}
              autoCapitalize="words"
              value={name}
              onChangeText={(t) => { setName(t); clearError('name'); }}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="seu@email.com"
              placeholderTextColor={colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => { setEmail(t); clearError('email'); }}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+55</Text>
              </View>
              <TextInput
                style={[styles.input, styles.phoneInput, errors.phone && styles.inputError]}
                placeholder="(11) 99999-9999"
                placeholderTextColor={colors.gray[400]}
                keyboardType="phone-pad"
                value={phone}
                maxLength={15}
                onChangeText={(t) => { setPhone(formatPhone(t)); clearError('phone'); }}
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                placeholder="Minimo 8 caracteres"
                placeholderTextColor={colors.gray[400]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); clearError('password'); }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar senha</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder="Repita sua senha"
              placeholderTextColor={colors.gray[400]}
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Criar minha conta</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Ja tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background.primary },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
    marginTop: spacing.xl,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary[700],
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: colors.success.dark,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  form: {
    width: '100%',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.gray[50],
  },
  inputError: {
    borderColor: colors.error.main,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countryCode: {
    height: 50,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  phoneInput: {
    flex: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 70,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[700],
  },
  errorText: {
    fontSize: 12,
    color: colors.error.main,
    marginTop: spacing.xs,
  },
  button: {
    height: 52,
    backgroundColor: colors.primary[700],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
  },
  loginText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
