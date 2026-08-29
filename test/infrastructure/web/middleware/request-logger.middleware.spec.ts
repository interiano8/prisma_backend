import { RequestLoggerMiddleware } from '../../../../src/infrastructure/web/middleware/request-logger.middleware';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

describe('RequestLoggerMiddleware', () => {
  it('registra la petición con request-id del header y llama a next', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = jest.spyOn(middleware['logger'], 'log').mockImplementation();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/health',
      ip: '127.0.0.1',
      header: () => 'abc-123',
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    res.setHeader = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123');
    expect(logSpy).toHaveBeenCalledWith(
      '[abc-123] GET /api/health - IP: 127.0.0.1',
    );
    expect(next).toHaveBeenCalled();
  });

  it('genera un request-id cuando no viene en el header', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = jest.spyOn(middleware['logger'], 'log').mockImplementation();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/health',
      ip: '127.0.0.1',
      header: () => undefined,
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    res.setHeader = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      expect.any(String),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[[0-9a-f-]{36}\] GET \/api\/health/),
    );
  });

  it('registra la finalización con status y duración', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = jest.spyOn(middleware['logger'], 'log').mockImplementation();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'POST',
      originalUrl: '/api/invoices/create',
      ip: '127.0.0.1',
      header: () => 'req-1',
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    res.setHeader = jest.fn();
    res.statusCode = 201;

    middleware.use(req, res, next);
    res.emit('finish');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[req-1\] POST \/api\/invoices\/create - 201 \(\d+ ms\)/,
      ),
    );
  });
});
