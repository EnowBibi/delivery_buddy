import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'OK but what should I do with an order?' })
  @IsString()
  @MinLength(1)
  content: string;
}
