export class FuelCalculatorService {
  calculateFuelAmount(volume: number, unitPrice: number): number {
    return volume * unitPrice;
  }

  calculateVolume(amount: number, unitPrice: number): number {
    if (unitPrice === 0) return 0;
    return amount / unitPrice;
  }

  formatVolume(gallons: number): number {
    return Number(gallons.toFixed(2));
  }

  formatAmount(amount: number): number {
    return Number(amount.toFixed(2));
  }
}
