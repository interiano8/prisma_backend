export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundDomainError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class UnauthorizedDomainError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class BadRequestDomainError extends DomainError {
  readonly code = 'BAD_REQUEST';
}

export class ForbiddenDomainError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class ConflictDomainError extends DomainError {
  readonly code = 'CONFLICT';
}

export class InternalDomainError extends DomainError {
  readonly code = 'INTERNAL';
}
