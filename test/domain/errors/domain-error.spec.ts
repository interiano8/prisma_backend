import {
  DomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  BadRequestDomainError,
  ForbiddenDomainError,
  ConflictDomainError,
  InternalDomainError,
} from '../../../src/domain/errors/domain-error';

describe('DomainError', () => {
  it.each([
    [NotFoundDomainError, 'NOT_FOUND', 'NotFoundDomainError'],
    [UnauthorizedDomainError, 'UNAUTHORIZED', 'UnauthorizedDomainError'],
    [BadRequestDomainError, 'BAD_REQUEST', 'BadRequestDomainError'],
    [ForbiddenDomainError, 'FORBIDDEN', 'ForbiddenDomainError'],
    [ConflictDomainError, 'CONFLICT', 'ConflictDomainError'],
    [InternalDomainError, 'INTERNAL', 'InternalDomainError'],
  ])(
    '%s expone code, name y message correctos',
    (ErrorClass, expectedCode, expectedName) => {
      const error = new ErrorClass('mensaje de prueba');

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(expectedCode);
      expect(error.name).toBe(expectedName);
      expect(error.message).toBe('mensaje de prueba');
    },
  );
});
