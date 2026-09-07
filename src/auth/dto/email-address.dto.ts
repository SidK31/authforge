import { IsEmail } from 'class-validator';

export class EmailAddressDto {
  @IsEmail()
  email!: string;
}
