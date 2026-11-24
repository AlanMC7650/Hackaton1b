export enum RolCliente {
  ADMIN = 'ADMIN',
  CLIENTE = 'CLIENTE',
}

export enum EstadoCliente {
  ACTIVO = 'ACTIVO',
  BAJA = 'BAJA',
}

export enum EstadoCuenta {
  ACTIVA = 'ACTIVA',
  CERRADA = 'CERRADA',
}

export enum TipoMovimiento {
  CREDITO = 'CREDITO',
  DEBITO = 'DEBITO',
}

export enum OrigenMovimiento {
  DEPOSITO = 'DEPOSITO',
  RETIRO = 'RETIRO',
  PAGO_SERVICIO = 'PAGO_SERVICIO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DESEMBOLSO = 'DESEMBOLSO',
  REVERSION = 'REVERSION',
}

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  COMPLETADO = 'COMPLETADO',
  RECHAZADO = 'RECHAZADO',
  REVERTIDO = 'REVERTIDO',
}

export enum TipoTransferencia {
  PROPIA = 'PROPIA',
  TERCERO = 'TERCERO',
  INTERBANCARIA = 'INTERBANCARIA',
}

export enum EstadoTransferencia {
  COMPLETADA = 'COMPLETADA',
  RECHAZADA = 'RECHAZADA',
  REVERTIDA = 'REVERTIDA',
}

export enum EstadoPrestamo {
  SOLICITADO = 'SOLICITADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  CANCELADO = 'CANCELADO',
}
