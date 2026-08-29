import { User } from '../../../src/domain/entities/user.entity';

describe('User entity', () => {
  describe('valid User objects', () => {
    it('should create a valid active user with all required fields', () => {
      const user: User = {
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
      };

      expect(user.id).toBe(1);
      expect(user.username).toBe('jdoe');
      expect(user.name).toBe('John Doe');
      expect(user.profile).toBe('ADMIN');
      expect(user.isActive).toBe(true);
    });

    it('should create a user with optional fields', () => {
      const user: User = {
        id: 2,
        username: 'cajero1',
        name: 'Maria Lopez',
        profile: 'CAJERO',
        isActive: true,
        passwordHash: 'AQAAAAEAACcQAAAAE...',
        codigoRfid: 'RFID12345',
        pinLeal: '1234',
      };

      expect(user.passwordHash).toBe('AQAAAAEAACcQAAAAE...');
      expect(user.codigoRfid).toBe('RFID12345');
      expect(user.pinLeal).toBe('1234');
    });

    it('should support inactive user', () => {
      const user: User = {
        id: 3,
        username: 'inactivo',
        name: 'User Inactive',
        profile: 'CAJERO',
        isActive: false,
      };

      expect(user.isActive).toBe(false);
    });
  });

  describe('type constraints', () => {
    it('should have correct types for all properties', () => {
      const user: User = {
        id: 100,
        username: 'test',
        name: 'Test User',
        profile: 'CAJERO',
        isActive: true,
        passwordHash: 'hash123',
        codigoRfid: 'RFID001',
        pinLeal: '9999',
      };

      expect(typeof user.id).toBe('number');
      expect(typeof user.username).toBe('string');
      expect(typeof user.name).toBe('string');
      expect(typeof user.profile).toBe('string');
      expect(typeof user.isActive).toBe('boolean');
      expect(typeof user.passwordHash).toBe('string');
      expect(typeof user.codigoRfid).toBe('string');
      expect(typeof user.pinLeal).toBe('string');
    });

    it('should allow undefined optional fields', () => {
      const user: User = {
        id: 4,
        username: 'minimal',
        name: 'Minimal User',
        profile: 'CAJERO',
        isActive: true,
      };

      expect(user.passwordHash).toBeUndefined();
      expect(user.codigoRfid).toBeUndefined();
      expect(user.pinLeal).toBeUndefined();
    });
  });
});
