import {
  LealCustomer,
  LealLoginResponse,
} from '../../entities/leal-transaction.entity';

export interface LealUseCase {
  loginLeal(credentials: {
    username: string;
    password: string;
    storeId: string;
  }): Promise<LealLoginResponse>;
  searchCustomer(
    documentId: string,
    token: string,
  ): Promise<LealCustomer | null>;
  registerCustomer(data: {
    documentId: string;
    name: string;
    email: string;
    phone: string;
    token: string;
  }): Promise<LealCustomer>;
  accumulatePoints(data: {
    customerId: string;
    invoiceNo: string;
    total: number;
    token: string;
  }): Promise<any>;
  redeemPoints(data: {
    customerId: string;
    points: number;
    invoiceNo: string;
    token: string;
  }): Promise<any>;
  reverseTransaction(
    transactionId: string,
    invoiceNo: string,
    token: string,
  ): Promise<any>;
}
