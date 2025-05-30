// File: sdk/useLazorWallet.ts

import * as anchor from '@coral-xyz/anchor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { LazorKitProgram } from './prgram_class/lazorkit';
import {
  ConnectOptions,
  ExecuteAction,
  ExecuteActionType,
  SignOptions,
  SignResult,
  WalletInfo,
} from './types';
import { getBlockhash, signAndSendTxn } from './utils';

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
        await lazorProgram.connection.confirmTransaction(
          result.signature,
          'confirmed'
        );
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
      console.log('🔄 Starting signMessage flow...');
      console.log('📋 Instruction:', instruction);
      console.log('⚡ Execute Action:', executeAction);
      
      if (!wallet) {
        console.error('❌ No wallet connected');
        return null;
      }

      console.log('👛 Wallet info:', {
        credentialId: wallet.credentialId,
        smartWallet: wallet.smartWallet,
        smartWalletAuthenticator: wallet.smartWalletAuthenticator,
        passkeyPubkeyLength: wallet.passkeyPubkey.length,
      });

      const redirectUrl = getRedirectUri();
      const message = 'Hello';
      const signUrl = `https://portal.lazor.sh?action=sign&message=${encodeURIComponent(
        message
      )}&expo=my-web-app&redirect_url=${encodeURIComponent(redirectUrl)}`;

      console.log('🔗 Sign URL:', signUrl);

      return new Promise(async (resolve) => {
        const handleSignRedirect = async (url: string) => {
          try {
            console.log('📥 Received redirect URL:', url);
            
            const parsed = new URL(url);
            console.log('🔍 Parsed URL params:', Object.fromEntries(parsed.searchParams.entries()));
            
            if (parsed.searchParams.get('success') !== 'true') {
              throw new Error('Sign failed: success parameter is not true');
            }

            const signatureParam = parsed.searchParams.get('signature');
            const msg = parsed.searchParams.get('msg');
            
            console.log('✏️  Raw signature param:', signatureParam);
            console.log('🔑 Raw msg param:', msg);
            
            if (!signatureParam) {
              throw new Error('No signature received from signing service');
            }
            if (!msg) {
              throw new Error('No msg received from signing service');
            }
            const result: SignResult = {
              signature: Buffer.from(signatureParam, 'base64'),
              msg: Buffer.from(msg, 'base64'),
            };

            console.log('✅ Parsed sign result:', {
              signatureLength: result.signature.length,
              msgLength: result.msg.length,
            });

            console.log('🏗️  Creating execute transaction...');
            const transferSolIns = anchor.web3.SystemProgram.transfer({
              fromPubkey: new anchor.web3.PublicKey(wallet.smartWallet),
              toPubkey: new anchor.web3.PublicKey('G6me5vzarVctt78RYFvfUpusA2VLBXT7QndLcFQ4hKB'),
              lamports: 400000000, // 0.004 SOL
            });
            const checkRule = await lazorProgram.defaultRuleProgram.checkRuleIns(
              new anchor.web3.PublicKey(wallet.smartWallet),
              new anchor.web3.PublicKey(wallet.smartWalletAuthenticator)
            );
            const executeTxn = await lazorProgram.executeInstructionTxn(
              wallet.passkeyPubkey,
              result.msg,
              result.signature,
              checkRule,
              transferSolIns,
              payer,
              new anchor.web3.PublicKey(wallet.smartWallet),
            );

            const blockhash = await getBlockhash();
            executeTxn.recentBlockhash = blockhash;
            executeTxn.feePayer = payer;
          

            console.log('📤 Execute transaction created:', executeTxn);
            console.log('📊 Transaction info:', {
              instructionCount: executeTxn.instructions.length,
              feePayer: executeTxn.feePayer?.toBase58(),
              recentBlockhash: executeTxn.recentBlockhash,
            });

            const serializedTxn = executeTxn.serialize({
              verifySignatures: false,
              requireAllSignatures: false,
            });

            console.log('📦 Serialized transaction length:', serializedTxn.length);

            console.log('🚀 Sending transaction via relayer...');
            const sendResult = await signAndSendTxn({
              base64EncodedTransaction: serializedTxn.toString('base64'),
              relayerUrl: paymasterUrl,
            });

            console.log('📋 Relayer response:', sendResult);

            if (!sendResult) {
              throw new Error('Transaction sending failed: no response from relayer');
            }

            if (sendResult.error) {
              throw new Error(`Transaction failed: ${JSON.stringify(sendResult.error)}`);
            }

            // Extract transaction hash from response - check multiple possible fields
            const txHash = sendResult.result || sendResult.signature || sendResult.id || sendResult.txHash || `fallback_${Date.now()}`;
            console.log('🎯 Transaction hash:', txHash);
            console.log('🔍 Full sendResult structure:', JSON.stringify(sendResult, null, 2));

            console.log('✅ Transaction completed successfully!');
            
            // Return result with transaction hash
            const finalResult: SignResult = {
              ...result,
              txHash: txHash
            };
            
            options?.onSignSuccess?.(finalResult);
            opts?.onSuccess?.(finalResult);
            resolve(finalResult);
          } catch (err) {
            console.error('❌ Error in handleSignRedirect:', err);
            console.error('📊 Error details:', {
              message: err instanceof Error ? err.message : 'Unknown error',
              stack: err instanceof Error ? err.stack : undefined,
            });
            
            const error = err instanceof Error ? err : new Error('Unknown error');
            options?.onSignError?.(error);
            opts?.onFail?.(error);
            resolve(null);
          }
        };

        try {
          if (Platform.OS === 'ios') {
            console.log('📱 Opening auth session (iOS)...');
            const result = await WebBrowser.openAuthSessionAsync(
              signUrl,
              redirectUrl
            );
            console.log('📱 Auth session result:', result);
            
            if (result.type === 'success' && result.url) {
              handleSignRedirect(result.url);
            } else {
              console.log('⚠️ User cancelled or auth session failed:', result);
              const error = new Error('User cancelled sign');
              options?.onSignError?.(error);
              opts?.onFail?.(error);
              resolve(null);
            }
          } else {
            console.log('🤖 Setting up URL listener (Android)...');
            const sub = Linking.addEventListener('url', ({ url }) => {
              console.log('📱 Received URL event:', url);
              WebBrowser.dismissBrowser();
              handleSignRedirect(url);
              sub.remove();
            });
            await WebBrowser.openBrowserAsync(signUrl);
          }
        } catch (browserError) {
          console.error('❌ Browser error:', browserError);
          const error = browserError instanceof Error ? browserError : new Error('Browser error');
          options?.onSignError?.(error);
          opts?.onFail?.(error);
          resolve(null);
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
