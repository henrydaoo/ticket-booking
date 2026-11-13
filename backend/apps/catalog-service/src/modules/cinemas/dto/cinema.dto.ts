import { IsString, MinLength } from 'class-validator';

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
