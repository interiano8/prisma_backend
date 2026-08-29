import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { DomainErrorFilter } from '../../../../src/infrastructure/web/filters/domain-error.filter';
import {
  DomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  BadRequestDomainError,
  ForbiddenDomainError,
  ConflictDomainError,
  InternalDomainError,
} from '../../../../src/domain/errors/domain-error';

describe('DomainErrorFilter', () => {
  const filter = new DomainErrorFilter();
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
  });

  it.each([
    [new NotFoundDomainError('no'), 404],
    [new UnauthorizedDomainError('no'), 401],
    [new BadRequestDomainError('no'), 400],
    [new ForbiddenDomainError('no'), 403],
    [new ConflictDomainError('no'), 409],
    [new InternalDomainError('no'), 500],
  ])('mapea %p a HTTP %i', (error: DomainError, expectedStatus: number) => {
    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(expectedStatus);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: expectedStatus,
      code: error.code,
      message: error.message,
    });
  });

  it('usa 500 para errores de dominio desconocidos', () => {
    class CustomDomainError extends DomainError {
      readonly code = 'CUSTOM';
      constructor() {
        super('custom');
      }
    }

    filter.catch(new CustomDomainError(), host);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
