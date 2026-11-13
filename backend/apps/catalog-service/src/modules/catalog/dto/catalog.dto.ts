import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MovieStatus {
  COMING_SOON = 'COMING_SOON',
  NOW_SHOWING = 'NOW_SHOWING',
  ENDED = 'ENDED',
}

export enum SeatType {
  STANDARD = 'STANDARD',
  VIP = 'VIP',
  COUPLE = 'COUPLE',
}

export class CreateMovieDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsString()
  genre!: string;

  @IsString()
  ageRating!: string;

  @IsUrl()
  posterUrl!: string;

  @IsUrl()
  trailerUrl!: string;

  @IsEnum(MovieStatus)
  status!: MovieStatus;
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  ageRating?: string;

  @IsOptional()
  @IsUrl()
  posterUrl?: string;

  @IsOptional()
  @IsUrl()
  trailerUrl?: string;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;
}

export class CreateCinemaDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CreateBranchDto {
  @IsString()
  cinemaId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  address!: string;
}

export class CreateScreenDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class SeatLayoutDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsEnum(SeatType)
  type!: SeatType;

  @IsString()
  @MinLength(1)
  row!: string;

  @IsInt()
  @Min(1)
  number!: number;
}

export class UpdateLayoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatLayoutDto)
  seats!: SeatLayoutDto[];
}
