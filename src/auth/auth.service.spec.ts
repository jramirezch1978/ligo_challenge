import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const config: Record<string, unknown> = {
    'jwt.expiresIn': 3600,
    'auth.mockUsername': 'senior.backend',
    'auth.mockPassword': 'Password123',
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

  it('returns a signed token for valid credentials', () => {
    const result = service.login({ username: 'senior.backend', password: 'Password123' });

    expect(result).toEqual({ token: 'signed.jwt.token', expiresIn: 3600 });
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 'senior.backend', username: 'senior.backend' },
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
});
