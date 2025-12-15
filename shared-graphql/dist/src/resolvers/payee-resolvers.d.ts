import { ValidatePayeeResult } from '../types/payee';
export declare const calculateNameSimilarity: (name1: string, name2: string) => number;
export declare const validatePayeeName: (inputName: string, registeredName: string) => ValidatePayeeResult;
export declare const validateAccountNumberFormat: (accountNumber: string, bankCode: string) => boolean;
