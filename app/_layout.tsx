import { LazorWalletProvider } from '../sdk';
import { Connection } from '@solana/web3.js';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const connection = new Connection(
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL!,
    'confirmed'
  );

  return (
    <LazorWalletProvider connection={connection}>
      <Stack>
        <Stack.Screen
          name='index'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='(tabs)'
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </LazorWalletProvider>
  );
}
