import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiProperty({ example: 'daily_bonus_points' })
  @IsString()
  key: string;

  @ApiProperty({ example: '75' })
  @IsString()
  value: string;
}
