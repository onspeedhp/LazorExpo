import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { useLazorWallet as useLazorWalletInternal } from './useLazorWallet';
import { WalletInfo, SignResult } from './types';
import * as anchor from '@coral-xyz/anchor';

interface Callbacks {
  onConnectSuccess?: (wallet: WalletInfo) => void;
  onConnectError?: (error: Error) => void;
  onSignSuccess?: (result: SignResult) => void;
  onSignError?: (error: Error) => void;
}

const WalletContext = createContext<ReturnType<
  typeof useLazorWalletInternal
> | null>(null);

const WalletCallbacksContext = createContext<Callbacks>({
  onConnectSuccess: undefined,
  onConnectError: undefined,
  onSignSuccess: undefined,
  onSignError: undefined,
});

export const LazorWalletProvider = ({
  connection,
  children,
}: {
  connection: anchor.web3.Connection;
  children: React.ReactNode;
}) => {
  const [callbacks, setCallbacks] = useState<Callbacks>({});

  const walletHook = useLazorWalletInternal({
    connection,
    ...callbacks,
  });

  return (
    <WalletCallbacksContext.Provider value={callbacks}>
      <WalletContext.Provider value={walletHook}>
        {children}
      </WalletContext.Provider>
    </WalletCallbacksContext.Provider>
  );
};

export const useLazorWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useLazorWallet must be used within LazorWalletProvider');
  }
  return context;
};

export const useSetLazorWalletCallbacks = (callbacks: Callbacks) => {
  const setCallbacks = useContextSetter(WalletCallbacksContext);
  useEffect(() => {
    setCallbacks(callbacks);
  }, [callbacks]);
};

// custom hook to get setter of context (safe)
function useContextSetter<T>(context: React.Context<T>) {
  const value = useContext(context);
  const [, setValue] = useState(value);
  return setValue;
}
