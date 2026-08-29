export interface LealCustomer {
  documentId: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  tier?: string;
}

export interface LealTransaction {
  id: string;
  customerId: string;
  type: 'accumulate' | 'redeem' | 'reverse';
  points: number;
  amount: number;
  invoiceNo: string;
  createdAt: string;
  status: string;
}

export interface LealLoginRequest {
  username: string;
  password: string;
  storeId: string;
}

export interface LealLoginResponse {
  token: string;
  expiresAt: string;
}

export interface LealSearchCustomerRequest {
  documentId: string;
  token: string;
}

export interface LealRegisterCustomerRequest {
  documentId: string;
  name: string;
  email: string;
  phone: string;
  token: string;
}

export interface LealAccumulatePointsRequest {
  customerId: string;
  invoiceNo: string;
  total: number;
  token: string;
}

export interface LealRedeemPointsRequest {
  customerId: string;
  points: number;
  invoiceNo: string;
  token: string;
}

export interface LealReverseTransactionRequest {
  transactionId: string;
  invoiceNo: string;
  token: string;
}
