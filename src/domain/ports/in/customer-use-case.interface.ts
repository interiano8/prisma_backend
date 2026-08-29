import { Customer } from '../../entities/customer.entity';

export interface CustomerUseCase {
  searchCustomers(query?: string, creditOnly?: boolean): Promise<Customer[]>;
  getConsumidorFinal(): Promise<Customer | null>;
}
