import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TransportationType } from '@prisma/client';

export class CompleteProfileDto {
  @ApiProperty({ example: 'WK-4587' })
  @IsString()
  workId: string;

  @ApiProperty({ example: 'Tyler Teeler' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'a1b2c3d4-uuid', required: false })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({ enum: TransportationType, example: 'bicycle' })
  @IsEnum(TransportationType)
  transportationType: TransportationType;

  @ApiProperty({ example: 'RE 345 6', required: false })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;
}
