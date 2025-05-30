'use client';

import { useLazorWallet } from '@/sdk/LazorWalletProvider';
import { Ionicons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import 'react-native-get-random-values';
global.Buffer = Buffer;

Buffer.prototype.subarray = function subarray(
  begin: number | undefined,
  end: number | undefined
) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype); // Explicitly add the `Buffer` prototype (adds `readUIntLE`!)
  return result;
};

export default function WelcomeScreen() {
  const [loading, setLoading] = useState<string | null>(null);

  const { wallet, isConnected, connect, disconnect , signMessage } = useLazorWallet();

  const handleConnect = async () => {
    setLoading('Connecting to wallet...');
    try {
      await connect();
      Alert.alert(
        'Connection Successful',
        'You are now connected to your wallet'
      );

      // wait 1 second before navigating
      setTimeout(() => {
        router.push('/(tabs)');
      }, 1000);
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to wallet');
    }
    setLoading(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.jpg')}
            style={styles.logo}
          />
          <Text style={styles.appName}>Lazor Wallet</Text>
          <Text style={styles.tagline}>Your Gateway to Solana</Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name='shield-checkmark' size={32} color='#6366f1' />
            <Text style={styles.featureTitle}>Secure</Text>
            <Text style={styles.featureDescription}>
              Your keys, your crypto
            </Text>
          </View>

          <View style={styles.feature}>
            <Ionicons name='flash' size={32} color='#6366f1' />
            <Text style={styles.featureTitle}>Fast</Text>
            <Text style={styles.featureDescription}>
              Lightning-fast transactions
            </Text>
          </View>

          <View style={styles.feature}>
            <Ionicons name='globe' size={32} color='#6366f1' />
            <Text style={styles.featureTitle}>Global</Text>
            <Text style={styles.featureDescription}>
              Send anywhere, anytime
            </Text>
          </View>
        </View>

        {/* Connect Button */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#6366f1' />
            <Text style={styles.loadingText}>{loading}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnect}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
            <Ionicons name='wallet-outline' size={20} color='#fff' />
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 24,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 40,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  connectButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
});
