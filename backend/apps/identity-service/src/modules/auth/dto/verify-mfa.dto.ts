import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class VerifyMfaDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
