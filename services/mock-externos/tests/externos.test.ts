import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '@chuno/shared';
import {
  confirmarPago,
  consultarDeuda,
  listarBancos,
  listarEmpresas,
  procesarTransferenciaAch,
} from '../src/services/externos.service';

test('listarEmpresas devuelve LUZ, AGUA, TEL y GAS', () => {
  const empresas = listarEmpresas();
  assert.deepEqual(
    empresas.map((e) => e.codigo),
    ['LUZ', 'AGUA', 'TEL', 'GAS'],
  );
});

test('consultarDeuda devuelve monto deterministico para un codigo valido', () => {
  const primera = consultarDeuda('LUZ', '1001');
  const segunda = consultarDeuda('LUZ', '1001');
  assert.deepEqual(primera, segunda);
  assert.equal(primera.monto, 185.5);

  const dinamicaA = consultarDeuda('AGUA', 'CLI-7741');
  const dinamicaB = consultarDeuda('AGUA', 'CLI-7741');
  assert.deepEqual(dinamicaA, dinamicaB);
  assert.ok(dinamicaA.monto > 0);
});

test('consultarDeuda lanza 404 para codigo o empresa inexistente', () => {
  assert.throws(
    () => consultarDeuda('LUZ', 'INEXISTENTE'),
    (err: unknown) => err instanceof AppError && err.statusCode === 404,
  );
  assert.throws(
    () => consultarDeuda('OTRA', '1001'),
    (err: unknown) => err instanceof AppError && err.statusCode === 404,
  );
});

test('confirmarPago devuelve comprobante o 502 si termina en 999', () => {
  const ok = confirmarPago('LUZ', {
    codigoCliente: '1001',
    monto: 185.5,
    referencia: '11111111-1111-4111-8111-111111111111',
  });
  assert.match(ok.comprobante, /^COMP-LUZ-/);

  assert.throws(
    () =>
      confirmarPago('LUZ', {
        codigoCliente: '12999',
        monto: 120,
        referencia: '22222222-2222-4222-8222-222222222222',
      }),
    (err: unknown) => err instanceof AppError && err.statusCode === 502,
  );
});

test('ACH devuelve 4 bancos, acepta cuentas validas y rechaza con 422 si termina en 999', () => {
  const bancos = listarBancos();
  assert.equal(bancos.length, 4);

  const achOk = procesarTransferenciaAch({
    bancoDestino: 'BAND',
    cuentaDestino: '1000200030',
    titular: 'Maria Perez',
    monto: 250,
    referencia: '33333333-3333-4333-8333-333333333333',
  });
  assert.equal(achOk.estado, 'ACEPTADA');
  assert.match(achOk.codigoAch, /^ACH-/);

  assert.throws(
    () =>
      procesarTransferenciaAch({
        bancoDestino: 'BAND',
        cuentaDestino: '555999',
        titular: 'Falla ACH',
        monto: 100,
        referencia: '44444444-4444-4444-8444-444444444444',
      }),
    (err: unknown) => err instanceof AppError && err.statusCode === 422,
  );
});
