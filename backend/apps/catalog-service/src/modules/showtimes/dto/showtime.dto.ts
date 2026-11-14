import { IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

function IsTimestampWithOffset(): PropertyDecorator {
  return (target, propertyKey) => {
    IsISO8601({ strict: true })(target, propertyKey);
    Matches(/(?:Z|[+-]\d{2}:\d{2})$/i)(target, propertyKey);
  };
}

export class CreateShowtimeDto {
  @IsUUID()
  movieId!: string;

  @IsUUID()
  screenId!: string;

  @IsTimestampWithOffset()
  startAt!: string;

  @IsTimestampWithOffset()
  endAt!: string;

  @IsOptional()
  @IsTimestampWithOffset()
  saleOpensAt?: string;
}

export class UpdateDraftShowtimeDto {
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @IsOptional()
  @IsTimestampWithOffset()
  startAt?: string;

  @IsOptional()
  @IsTimestampWithOffset()
  endAt?: string;

  @IsOptional()
  @IsTimestampWithOffset()
  saleOpensAt?: string;
}

export class PublishShowtimeDto {
  @IsOptional()
  @IsTimestampWithOffset()
  saleOpensAt?: string;
}

export class ShowtimeQueryDto {
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsTimestampWithOffset()
  from?: string;

  @IsOptional()
  @IsTimestampWithOffset()
  to?: string;
}
