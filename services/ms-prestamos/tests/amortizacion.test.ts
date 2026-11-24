import { calcularPlan, sumarMeses } from '../src/services/amortizacion';

describe('HU-11: cuota fija con sistema francés', () => {
  it('calcula la cuota de 10 000 Bs a 12 meses al 12 % anual', () => {
    const plan = calcularPlan(10_000, 12, 12, '2026-11-24');
    expect(plan.cuotaMensual).toBe(888.49);
    expect(plan.cuotas).toHaveLength(12);
    expect(plan.cuotas[0]).toMatchObject({ numero: 1, fechaVencimiento: '2026-12-24', interes: 100, capital: 788.49 });
  });

  it('cierra el saldo en 0 y el capital suma el monto', () => {
    const plan = calcularPlan(25_000, 18.5, 36, '2026-11-24');
    const ultima = plan.cuotas[plan.cuotas.length - 1];
    expect(ultima.saldo).toBe(0);
    const capital = plan.cuotas.reduce((acc, c) => acc + c.capital, 0);
    expect(Math.round(capital * 100) / 100).toBe(25_000);
  });

  it('soporta tasa 0', () => {
    const plan = calcularPlan(1_200, 0, 12, '2026-11-24');
    expect(plan.cuotaMensual).toBe(100);
    expect(plan.totalInteres).toBe(0);
  });

  it('ajusta fechas a fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-11-24', 2)).toBe('2027-01-24');
  });
});
