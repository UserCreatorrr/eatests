// Jerarquía única de errores. Las rutas los convierten al sobre
// { error: { code, message, details } } con el HTTP que corresponda.
// Añadir un tipo nuevo es crear una subclase: nada que tocar en las rutas.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) { super(message, 'VALIDATION_ERROR', 400, details) }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') { super(message, 'UNAUTHORIZED', 401) }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Sin permiso') { super(message, 'FORBIDDEN', 403) }
}
export class NotFoundError extends AppError {
  constructor(message = 'No encontrado', details: Record<string, unknown> = {}) { super(message, 'NOT_FOUND', 404, details) }
}
export class ConflictError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) { super(message, 'CONFLICT', 409, details) }
}
export class RateLimitedError extends AppError {
  constructor(message = 'Demasiadas peticiones') { super(message, 'RATE_LIMITED', 429) }
}
