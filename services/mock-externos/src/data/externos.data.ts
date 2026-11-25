export interface EmpresaExterna {
  codigo: string;
  nombre: string;
  tipo: 'LUZ' | 'AGUA' | 'TEL' | 'GAS';
}

export interface BancoExterno {
  codigo: string;
  nombre: string;
}

export interface DeudaSeed {
  titular: string;
  periodo: string;
  monto: number;
}

export const EMPRESAS_EXTERNAS: EmpresaExterna[] = [
  { codigo: 'LUZ', nombre: 'Electricidad', tipo: 'LUZ' },
  { codigo: 'AGUA', nombre: 'Agua Potable', tipo: 'AGUA' },
  { codigo: 'TEL', nombre: 'Telefonía', tipo: 'TEL' },
  { codigo: 'GAS', nombre: 'Gas Domiciliario', tipo: 'GAS' },
];

export const BANCOS_ACH: BancoExterno[] = [
  { codigo: 'BAND', nombre: 'Banco Andino S.A.' },
  { codigo: 'BSUR', nombre: 'Banco del Sur' },
  { codigo: 'BALT', nombre: 'Banco Altiplano' },
  { codigo: 'BORI', nombre: 'Banco Oriental' },
];

export const DEUDAS_PREDEFINIDAS: Record<string, DeudaSeed> = {
  'LUZ:1001': { titular: 'Juan Pérez Mamani', periodo: '2026-11', monto: 185.5 },
  'AGUA:1001': { titular: 'Juan Pérez Mamani', periodo: '2026-11', monto: 94.2 },
  'TEL:1001': { titular: 'Juan Pérez Mamani', periodo: '2026-11', monto: 68.0 },
  'GAS:1001': { titular: 'Juan Pérez Mamani', periodo: '2026-11', monto: 52.4 },
  'LUZ:1002': { titular: 'María López Quispe', periodo: '2026-11', monto: 210.75 },
  'AGUA:2001': { titular: 'Carlos Mendoza Rojas', periodo: '2026-11', monto: 312.8 },
  'TEL:3001': { titular: 'Ana Vargas Flores', periodo: '2026-11', monto: 115.0 },
  'GAS:4001': { titular: 'Luis Choque Condori', periodo: '2026-11', monto: 48.9 },
  '*:12999': { titular: 'Caso Prueba Compensación', periodo: '2026-11', monto: 120.0 },
  '*:999': { titular: 'Caso Prueba Falla Externa', periodo: '2026-11', monto: 99.9 },
};

export const CODIGOS_INEXISTENTES = new Set(['000', '0000', '00000', '404', 'INEXISTENTE', 'NOEXISTE', 'NO-EXISTE']);
