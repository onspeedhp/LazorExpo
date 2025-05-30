// File: sdk/useLazorWallet.ts

import { useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LazorKitProgram } from './prgram_class/lazorkit';
import * as anchor from '@coral-xyz/anchor';
import {
  ConnectOptions,
  ExecuteAction,
  ExecuteActionType,
  SignOptions,
  SignResult,
  WalletInfo,
} from './types';
import { signAndSendTxn } from './utils';
import { Buffer } from 'buffer';

interface UseLazorWalletOptions {
  connection: anchor.web3.Connection;
  onConnectSuccess?: (wallet: WalletInfo) => void;
  onConnectError?: (error: Error) => void;
  onSignSuccess?: (result: SignResult) => void;
  onSignError?: (error: Error) => void;
}

const STORAGE_KEY = 'lazor_wallet_info';

export function useLazorWallet(options: UseLazorWalletOptions) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const paymasterUrl = 'https://lazorkit-paymaster.onrender.com';
  const lazorProgram = new LazorKitProgram(options.connection);
  const payer = new anchor.web3.PublicKey(
    'hij78MKbJSSs15qvkHWTDCtnmba2c1W4r1V22g5sD8w'
  );

  useEffect(() => {
    const loadStoredWallet = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(parsed);
          setWallet(parsed);
        }
      } catch (err) {
        console.error('Failed to load stored wallet:', err);
      }
    };
    loadStoredWallet();
  }, []);

  const saveWallet = async (data: WalletInfo) => {
    console.log('Saving wallet:', data);

    try {
      let { smartWallet, smartWalletAuthenticator } =
        await lazorProgram.getSmartWalletByPasskey(data.passkeyPubkey);

      if (!smartWallet || !smartWalletAuthenticator) {
        console.log('Creating new smart wallet...');
        const txn = await lazorProgram.createSmartWalletTxn(
          Array.from(data.passkeyPubkey),
          null,
          payer // Replace with actual payer if needed
        );

        console.log('Transaction to create smart wallet:', txn);

        const result = await signAndSendTxn({
          base64EncodedTransaction: txn
            .serialize({ verifySignatures: false, requireAllSignatures: false })
            .toString('base64'),
          relayerUrl: paymasterUrl,
        });

        console.log('Smart wallet creation txn result:', result);

        ({ smartWallet, smartWalletAuthenticator } =
          await lazorProgram.getSmartWalletByPasskey(data.passkeyPubkey));

        console.log(smartWallet, smartWalletAuthenticator);

        if (!smartWallet || !smartWalletAuthenticator) {
          throw new Error('Failed to create smart wallet');
        }
      }

      const updatedWallet = {
        ...data,
        smartWallet: smartWallet.toBase58(),
        smartWalletAuthenticator: smartWalletAuthenticator.toBase58(),
      };

      console.log('Updated wallet info:', updatedWallet);

      setWallet(updatedWallet);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWallet));
    } catch (err) {
      console.error('Failed to save wallet:', err);
      throw err;
    }
  };

  const clearWallet = async () => {
    try {
      setWallet(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear wallet:', err);
    }
  };

  const getRedirectUri = () => Linking.createURL('/auth');

  const handleRedirect = (url: string): WalletInfo | null => {
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.get('success') !== 'true') return null;
      if (!parsed.searchParams.get('credentialId')) return null;

      const passkeyPubkey = Array.from(
        Buffer.from(parsed.searchParams.get('publicKey') || '', 'base64')
      );
      if (passkeyPubkey.length === 0) return null;

      return {
        credentialId: parsed.searchParams.get('credentialId') || '',
        passkeyPubkey,
        expo: parsed.searchParams.get('expo') || '',
        platform: parsed.searchParams.get('platform') || '',
        smartWallet: '',
        smartWalletAuthenticator: '',
      };
    } catch (err) {
      console.error('Failed to parse redirect URL:', err);
      return null;
    }
  };

  const connect = useCallback(async (opts?: ConnectOptions) => {
    const redirectUrl = getRedirectUri();
    const connectUrl = `https://portal.lazor.sh?action=connect&expo=my-web-app&redirect_url=${encodeURIComponent(
      redirectUrl
    )}`;

    try {
      const handleSuccess = async (walletInfo: WalletInfo) => {
        await saveWallet(walletInfo);
        options?.onConnectSuccess?.(walletInfo);
        opts?.onSuccess?.(walletInfo);
      };

      if (Platform.OS === 'ios') {
        const result = await WebBrowser.openAuthSessionAsync(
          connectUrl,
          redirectUrl
        );
        if (result.type === 'success' && result.url) {
          const walletInfo = handleRedirect(result.url);
          if (!walletInfo) throw new Error('Invalid wallet info');
          await handleSuccess(walletInfo);
        }
      } else {
        const sub = Linking.addEventListener('url', async ({ url }) => {
          try {
            WebBrowser.dismissBrowser();
            const walletInfo = handleRedirect(url);
            if (!walletInfo) throw new Error('Invalid wallet info');
            await handleSuccess(walletInfo);
          } catch (err) {
            options?.onConnectError?.(
              err instanceof Error ? err : new Error('Unknown error')
            );
            opts?.onFail?.(
              err instanceof Error ? err : new Error('Unknown error')
            );
          } finally {
            sub.remove();
          }
        });
        await WebBrowser.openBrowserAsync(connectUrl);
      }
    } catch (err) {
      options?.onConnectError?.(
        err instanceof Error ? err : new Error('Unknown error')
      );
      opts?.onFail?.(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearWallet();
  }, []);

  const signMessage = useCallback(
    async (
      instruction: anchor.web3.TransactionInstruction,
      executeAction: ExecuteActionType = ExecuteAction.ExecuteCpi,
      opts?: SignOptions
    ): Promise<SignResult | null> => {
      if (!wallet) return null;

      const redirectUrl = getRedirectUri();
      const message = 'Hello';
      const signUrl = `https://portal.lazor.sh?action=sign&message=${encodeURIComponent(
        message
      )}&expo=my-web-app&redirect_url=${encodeURIComponent(redirectUrl)}`;

      return new Promise(async (resolve) => {
        const handleSignRedirect = async (url: string) => {
          try {
            const parsed = new URL(url);
            if (parsed.searchParams.get('success') !== 'true')
              throw new Error('Sign failed');

            // TODO: Return message
            const result: SignResult = {
              signature: Buffer.from(
                parsed.searchParams.get('signature') || '',
                'base64'
              ),
              publicKeyHash: Buffer.from(
                parsed.searchParams.get('publicKeyHash') || '',
                'base64'
              ),
            };

            const executeTxn = await lazorProgram.executeInstructionTxn(
              wallet.passkeyPubkey,
              Buffer.from(message),
              result.signature,
              null,
              instruction,
              payer,
              new anchor.web3.PublicKey(wallet.smartWallet),
              new anchor.web3.PublicKey(wallet.smartWalletAuthenticator),
              executeAction
            );

            const sendResult = await signAndSendTxn({
              base64EncodedTransaction: executeTxn
                .serialize({
                  verifySignatures: false,
                  requireAllSignatures: false,
                })
                .toString('base64'),
              relayerUrl: paymasterUrl,
            });

            if (!sendResult) throw new Error('Transaction sending failed');

            options?.onSignSuccess?.(result);
            opts?.onSuccess?.(result);
            resolve(result);
          } catch (err) {
            const error =
              err instanceof Error ? err : new Error('Unknown error');
            options?.onSignError?.(error);
            opts?.onFail?.(error);
            resolve(null);
          }
        };

        if (Platform.OS === 'ios') {
          const result = await WebBrowser.openAuthSessionAsync(
            signUrl,
            redirectUrl
          );
          if (result.type === 'success' && result.url) {
            handleSignRedirect(result.url);
          } else {
            const error = new Error('User cancelled sign');
            options?.onSignError?.(error);
            opts?.onFail?.(error);
            resolve(null);
          }
        } else {
          const sub = Linking.addEventListener('url', ({ url }) => {
            WebBrowser.dismissBrowser();
            handleSignRedirect(url);
            sub.remove();
          });
          await WebBrowser.openBrowserAsync(signUrl);
        }
      });
    },
    [wallet]
  );

  return {
    wallet,
    isConnected: !!wallet,
    connect,
    disconnect,
    signMessage,
  };
}
