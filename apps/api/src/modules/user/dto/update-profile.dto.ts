import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Joao Silva Jr' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.betbrinks.com/avatars/123.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
