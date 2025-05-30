import { LazorWalletProvider } from '@/sdk/LazorWalletProvider';
import { Connection } from '@solana/web3.js';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const connection = new Connection(
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL!,
    'confirmed'
  );
  return (
    <LazorWalletProvider connection={connection}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='index' />
        <Stack.Screen name='(tabs)' />
      </Stack>
    </LazorWalletProvider>
  );
}
