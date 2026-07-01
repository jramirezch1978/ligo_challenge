import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'senior.backend' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  username: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
