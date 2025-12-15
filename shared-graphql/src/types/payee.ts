export interface Payee {
  id: string;
  name: string;
  accountNumber: string;
  bankCode: string;
  accountType: 'CHECKING' | 'SAVINGS';
}

export interface ValidatePayeeInput {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface ValidatePayeeResult {
  isValid: boolean;
  matchLevel: 'EXACT' | 'CLOSE' | 'NO_MATCH';
  confidence: number;
  suggestedName?: string;
}

export interface PayeeServiceDependencies {
  dataSource: {
    fetchRegisteredName: (accountNumber: string, bankCode: string) => Promise<string>;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error: any) => void;
  };
}
