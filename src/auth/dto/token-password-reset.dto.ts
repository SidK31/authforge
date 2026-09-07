import { IsString, MinLength } from 'class-validator';

export class TokenPasswordResetDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}
