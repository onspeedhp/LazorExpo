import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <LazorKitProvider
      rpcUrl={process.env.EXPO_PUBLIC_SOLANA_RPC_URL!}
      ipfsUrl='https://ipfs-backup-git-main-chauanhtuan185s-projects.vercel.app'
      paymasterUrl='https://lazorkit-paymaster.onrender.com'
    >
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
    </LazorKitProvider>
  );
}
