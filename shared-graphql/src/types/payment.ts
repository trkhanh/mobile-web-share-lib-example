export interface Payment {
  id: string;
  amount: number;
  currency: string;
  fromAccount: string;
  toAccount: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  providerRef?: string;
  createdAt: string;
  userId: string;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  fromAccount: string;
  toAccount: string;
  userId: string;
}
