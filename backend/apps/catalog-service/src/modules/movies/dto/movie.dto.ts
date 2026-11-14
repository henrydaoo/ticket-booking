import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from 'class-validator';

export enum MovieStatus {
  COMING_SOON = 'COMING_SOON',
  NOW_SHOWING = 'NOW_SHOWING',
  ENDED = 'ENDED',
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
