export class ValueToLettersService {
  private readonly unidades = [
    '',
    'Uno',
    'Dos',
    'Tres',
    'Cuatro',
    'Cinco',
    'Seis',
    'Siete',
    'Ocho',
    'Nueve',
  ];
  private readonly especiales = [
    'Diez',
    'Once',
    'Doce',
    'Trece',
    'Catorce',
    'Quince',
    'Dieciséis',
    'Diecisiete',
    'Dieciocho',
    'Diecinueve',
  ];
  private readonly decenas = [
    '',
    'Diez',
    'Veinte',
    'Treinta',
    'Cuarenta',
    'Cincuenta',
    'Sesenta',
    'Setenta',
    'Ochenta',
    'Noventa',
  ];
  private readonly centenas = [
    '',
    'Ciento',
    'Doscientos',
    'Trescientos',
    'Cuatrocientos',
    'Quinientos',
    'Seiscientos',
    'Setecientos',
    'Ochocientos',
    'Novecientos',
  ];

  convert(value: number): string {
    const entero = Math.floor(value);
    let decimal = Math.round((value - entero) * 100);
    if (decimal === 100) {
      decimal = 0;
    }
    const parteEntera = this.convertirEntero(entero);
    const parteDecimal = this.convertirDecimal(decimal);
    const moneda = entero === 1 ? 'lempira' : 'lempiras';
    const centavos = decimal === 1 ? 'centavo' : 'centavos';
    const resultado = `${parteEntera} ${moneda} con ${parteDecimal} ${centavos}`;
    return this.toTitleCase(resultado.trim());
  }

  private convertirEntero(numero: number): string {
    if (numero === 0) return 'cero';
    let resultado = '';
    if (numero >= 1000000) {
      const millones = Math.floor(numero / 1000000);
      resultado +=
        millones === 1
          ? 'Un millón'
          : `${this.convertirEntero(millones)} millones`;
      numero %= 1000000;
    }
    if (numero >= 1000) {
      const miles = Math.floor(numero / 1000);
      resultado += miles === 1 ? ' mil' : ` ${this.convertirEntero(miles)} mil`;
      numero %= 1000;
    }
    if (numero >= 100) {
      if (numero === 100) {
        resultado += ' cien';
        return resultado.trim();
      }
      resultado += ` ${this.centenas[Math.floor(numero / 100)]}`;
      numero %= 100;
    }
    if (numero >= 30) {
      resultado += ` ${this.decenas[Math.floor(numero / 10)]}`;
      if (numero % 10 > 0) resultado += ` y ${this.unidades[numero % 10]}`;
    } else if (numero >= 20) {
      const unidad = numero % 10;
      resultado +=
        unidad === 0
          ? ' veinte'
          : ` veinti${this.unidades[unidad].toLowerCase()}`;
    } else if (numero >= 10) {
      resultado += ` ${this.especiales[numero - 10]}`;
    } else if (numero > 0) {
      resultado += ` ${this.unidades[numero]}`;
    }
    return resultado.trim();
  }

  private convertirDecimal(numero: number): string {
    if (numero >= 100) numero %= 100;
    if (numero === 0) return 'cero';
    if (numero >= 30) {
      let r = this.decenas[Math.floor(numero / 10)];
      if (numero % 10 > 0) r += ` y ${this.unidades[numero % 10]}`;
      return r.trim().toLowerCase();
    } else if (numero >= 20) {
      const unidad = numero % 10;
      return unidad === 0
        ? 'veinte'
        : `veinti${this.unidades[unidad].toLowerCase()}`;
    } else if (numero >= 10) {
      return this.especiales[numero - 10].toLowerCase();
    }
    return this.unidades[numero].toLowerCase();
  }

  private toTitleCase(text: string): string {
    return text.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
    );
  }
}
