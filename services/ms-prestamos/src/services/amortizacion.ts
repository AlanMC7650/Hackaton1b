/**
 * Cálculo de cuota fija con el sistema francés (HU-11 CA-02).
 * Función pura, sin dependencias, para poder probarla sola.
 */
export interface CuotaPlan {
  numero: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  cuota: number;
  saldo: number;
}

export interface PlanPrestamo {
  cuotaMensual: number;
  totalInteres: number;
  totalPagar: number;
  cuotas: CuotaPlan[];
}

export function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Suma meses a una fecha 'YYYY-MM-DD' ajustando al último día del mes si hace falta. */
export function sumarMeses(fechaBase: string, meses: number): string {
  const [anio, mes, dia] = fechaBase.split('-').map(Number);
  const total = mes - 1 + meses;
  const anioDestino = anio + Math.floor(total / 12);
  const mesDestino = total % 12;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino + 1, 0)).getUTCDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return `${anioDestino}-${String(mesDestino + 1).padStart(2, '0')}-${String(diaDestino).padStart(2, '0')}`;
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * i = tasaAnual / 12 / 100 ; cuota = monto × i / (1 − (1 + i)^−n)
 * Se redondea a 2 decimales y la última cuota se ajusta para que el saldo cierre en 0.
 */
export function calcularPlan(monto: number, tasaAnual: number, plazoMeses: number, fechaInicio = hoy()): PlanPrestamo {
  const i = tasaAnual / 12 / 100;
  const n = plazoMeses;
  const cuotaMensual = redondear(i === 0 ? monto / n : (monto * i) / (1 - Math.pow(1 + i, -n)));

  const cuotas: CuotaPlan[] = [];
  let saldo = redondear(monto);

  for (let numero = 1; numero <= n; numero += 1) {
    const interes = redondear(saldo * i);
    const capital = numero === n ? saldo : redondear(Math.min(cuotaMensual - interes, saldo));
    saldo = redondear(saldo - capital);
    cuotas.push({
      numero,
      fechaVencimiento: sumarMeses(fechaInicio, numero),
      capital,
      interes,
      cuota: redondear(capital + interes),
      saldo,
    });
  }

  const totalInteres = redondear(cuotas.reduce((acc, c) => acc + c.interes, 0));
  const totalPagar = redondear(cuotas.reduce((acc, c) => acc + c.cuota, 0));

  return { cuotaMensual, totalInteres, totalPagar, cuotas };
}
