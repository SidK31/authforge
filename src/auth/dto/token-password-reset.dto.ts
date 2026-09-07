import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class TokenPasswordResetDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}
