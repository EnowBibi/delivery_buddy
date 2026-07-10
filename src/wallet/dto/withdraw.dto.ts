import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({ example: 670.0 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
