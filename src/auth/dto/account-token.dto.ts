import { IsString, MinLength } from 'class-validator';

export class AccountTokenDto {
  @IsString()
  @MinLength(32)
  token!: string;
}
