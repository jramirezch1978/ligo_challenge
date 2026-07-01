import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserRole } from '@app/common/enums/user-role.enum';

interface MockAccount {
  username: string;
  password: string;
  role: UserRole;
  ownerName: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  login(dto: LoginDto): LoginResponseDto {
    const account = this.resolveAccount(dto.username, dto.password);
    if (!account) {
      // Generic message on purpose: never reveal whether the username exists.
      throw new UnauthorizedException('Invalid username or password');
    }

    const expiresIn = this.configService.get<number>('jwt.expiresIn', 3600);
    const payload: JwtPayload = {
      sub: account.username,
      username: account.username,
      role: account.role,
      ownerName: account.ownerName,
    };
    const token = this.jwtService.sign(payload, { expiresIn });

    return { token, expiresIn };
  }

  /**
   * Resolves the demo/mock identity matching the given credentials. There is no real user
   * store: two fixed accounts are provisioned via environment variables so the ownership
   * authorization rule (ADMIN vs CUSTOMER, see WalletAccessService) can be exercised end to end.
   */
  private resolveAccount(username: string, password: string): MockAccount | null {
    const admin: MockAccount = {
      username: this.configService.get<string>('auth.mockUsername', ''),
      password: this.configService.get<string>('auth.mockPassword', ''),
      role: UserRole.ADMIN,
      ownerName: null,
    };
    const customer: MockAccount = {
      username: this.configService.get<string>('auth.customerUsername', ''),
      password: this.configService.get<string>('auth.customerPassword', ''),
      role: UserRole.CUSTOMER,
      ownerName: this.configService.get<string>('auth.customerOwnerName', ''),
    };

    return [admin, customer].find(
      (account) =>
        this.safeCompare(username, account.username) &&
        this.safeCompare(password, account.password),
    ) ?? null;
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
