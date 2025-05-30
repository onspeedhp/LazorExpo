import * as anchor from '@coral-xyz/anchor';

import { Lazorkit } from './program_types/lazorkit';

export type CpiData = anchor.IdlTypes<Lazorkit>['cpiData'];
export type SmartWalletSeq = anchor.IdlTypes<Lazorkit>['smartWalletSeq'];
export type SmartWalletConfig = anchor.IdlTypes<Lazorkit>['smartWalletConfig'];
export type SmartWalletAuthenticator =
  anchor.IdlTypes<Lazorkit>['smartWalletAuthenticator'];

export type SmartWallet = anchor.Idl;

export const ExecuteAction = {
  ['ExecuteCpi']: { executeCpi: {} },
  ['ChangeProgramRule']: { changeProgramRule: {} },
  ['CheckAuthenticator']: { checkAuthenticator: {} },
  ['CallRuleProgram']: { callRuleProgram: {} },
};

export type ExecuteActionType = anchor.IdlTypes<Lazorkit>['action'];

export interface WalletInfo {
  credentialId: string;
  passkeyPubkey: number[];
  platform: string;
  expo: string;
  smartWallet: string;
  smartWalletAuthenticator: string;
}

export interface SignResult {
  signature: Buffer;
  publicKeyHash: Buffer;
}

export type ConnectOptions = {
  onSuccess?: (wallet: WalletInfo) => void;
  onFail?: (error: Error) => void;
};

export type SignOptions = {
  onSuccess?: (result: SignResult) => void;
  onFail?: (error: Error) => void;
};
