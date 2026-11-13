import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export enum SeatType {
  STANDARD = 'STANDARD',
  VIP = 'VIP',
  COUPLE = 'COUPLE',
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

export class ScreenSeatPriceDto {
  @IsEnum(SeatType)
  seatType!: SeatType;

  @IsInt()
  @Min(0)
  priceVnd!: number;
}

export class UpdateScreenPricesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScreenSeatPriceDto)
  prices!: ScreenSeatPriceDto[];
}
