import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '@app/common/enums/user-role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const config: Record<string, unknown> = {
    'jwt.expiresIn': 3600,
    'auth.mockUsername': 'senior.backend',
    'auth.mockPassword': 'Password123',
    'auth.customerUsername': 'juan.perez',
    'auth.customerPassword': 'Cliente123',
    'auth.customerOwnerName': 'Juan Perez',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
        {
          provide: ConfigService,
          useValue: { get: (key: string, defaultValue?: unknown) => config[key] ?? defaultValue },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  it('returns a signed ADMIN token for the mock back-office credentials', () => {
    const result = service.login({ username: 'senior.backend', password: 'Password123' });

    expect(result).toEqual({ token: 'signed.jwt.token', expiresIn: 3600 });
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 'senior.backend', username: 'senior.backend', role: UserRole.ADMIN, ownerName: null },
      { expiresIn: 3600 },
    );
  });

  it('returns a signed CUSTOMER token scoped to a wallet owner for the demo customer credentials', () => {
    const result = service.login({ username: 'juan.perez', password: 'Cliente123' });

    expect(result).toEqual({ token: 'signed.jwt.token', expiresIn: 3600 });
    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'juan.perez',
        username: 'juan.perez',
        role: UserRole.CUSTOMER,
        ownerName: 'Juan Perez',
      },
      { expiresIn: 3600 },
    );
  });

  it('throws UnauthorizedException for an invalid password', () => {
    expect(() => service.login({ username: 'senior.backend', password: 'wrong' })).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for an invalid username', () => {
    expect(() => service.login({ username: 'someone.else', password: 'Password123' })).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when mixing credentials across accounts', () => {
    expect(() => service.login({ username: 'senior.backend', password: 'Cliente123' })).toThrow(
      UnauthorizedException,
    );
  });
});
