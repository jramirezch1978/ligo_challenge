import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  login(dto: LoginDto): LoginResponseDto {
    if (!this.isValidCredentials(dto.username, dto.password)) {
      // Generic message on purpose: never reveal whether the username exists.
      throw new UnauthorizedException('Invalid username or password');
    }

    const expiresIn = this.configService.get<number>('jwt.expiresIn', 3600);
    const payload: JwtPayload = { sub: dto.username, username: dto.username };
    const token = this.jwtService.sign(payload, { expiresIn });

    return { token, expiresIn };
  }

  private isValidCredentials(username: string, password: string): boolean {
    const expectedUsername = this.configService.get<string>('auth.mockUsername', '');
    const expectedPassword = this.configService.get<string>('auth.mockPassword', '');

    return (
      this.safeCompare(username, expectedUsername) && this.safeCompare(password, expectedPassword)
    );
  }

  /** Constant-time comparison to avoid leaking information through response-time side channels. */
  private safeCompare(input: string, expected: string): boolean {
    const length = Math.max(input.length, expected.length, 1);
    const inputBuffer = Buffer.alloc(length);
    const expectedBuffer = Buffer.alloc(length);
    inputBuffer.write(input);
    expectedBuffer.write(expected);

    return timingSafeEqual(inputBuffer, expectedBuffer) && input.length === expected.length;
  }
}
