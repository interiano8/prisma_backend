import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  BadRequestDomainError,
  ForbiddenDomainError,
  ConflictDomainError,
  InternalDomainError,
} from '../../../domain/errors/domain-error';

const STATUS_BY_ERROR: Record<string, HttpStatus> = {
  [NotFoundDomainError.name]: HttpStatus.NOT_FOUND,
  [UnauthorizedDomainError.name]: HttpStatus.UNAUTHORIZED,
  [BadRequestDomainError.name]: HttpStatus.BAD_REQUEST,
  [ForbiddenDomainError.name]: HttpStatus.FORBIDDEN,
  [ConflictDomainError.name]: HttpStatus.CONFLICT,
  [InternalDomainError.name]: HttpStatus.INTERNAL_SERVER_ERROR,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      STATUS_BY_ERROR[exception.constructor.name] ??
      HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
