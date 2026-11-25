import type { DataSource } from 'typeorm';
import { EmpresaEntity, TipoEmpresa } from '../entities/empresa.entity';

const EMPRESAS_INICIALES: Array<Pick<EmpresaEntity, 'codigo' | 'nombre' | 'tipo' | 'activo'>> = [
  { codigo: 'LUZ', nombre: 'Electricidad', tipo: TipoEmpresa.LUZ, activo: true },
  { codigo: 'AGUA', nombre: 'Agua Potable', tipo: TipoEmpresa.AGUA, activo: true },
  { codigo: 'TEL', nombre: 'Telefonía', tipo: TipoEmpresa.TELEFONO, activo: true },
  { codigo: 'GAS', nombre: 'Gas Domiciliario', tipo: TipoEmpresa.GAS, activo: true },
];

export async function seedEmpresas(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(EmpresaEntity);
  for (const item of EMPRESAS_INICIALES) {
    const existe = await repo.findOne({ where: { codigo: item.codigo } });
    if (!existe) {
      await repo.save(repo.create(item));
    }
  }
}
