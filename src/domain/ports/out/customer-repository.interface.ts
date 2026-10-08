import { Customer } from '../../entities/customer.entity';

export interface CustomerRepository {
  search(
    query?: string,
    creditOnly?: boolean,
    page?: number,
    pageSize?: number,
  ): Promise<
    | Customer[]
    | { total: number; page: number; pageSize: number; data: Customer[] }
  >;
  findByCode(code: string): Promise<Customer | null>;
  findByRtn(rtn: string): Promise<Customer | null>;
  getConsumidorFinalCode(): Promise<string | null>;
  createCustomer(
    code: string,
    name: string,
    rtn: string,
  ): Promise<{ success: boolean; code: string; name: string; rtf: string }>;
  updateBalance?(code: string, delta: number): Promise<void>;
  refreshCustomerData?(
    code: string,
    data: { balance?: number; creditLimit?: number; blocked?: boolean },
  ): Promise<void>;
}
