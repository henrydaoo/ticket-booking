import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  mfaCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  recoveryCode?: string;
}
