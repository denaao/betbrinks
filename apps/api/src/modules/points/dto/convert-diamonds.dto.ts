import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ConvertDiamondsDto {
  @ApiProperty({ example: 100, description: 'Quantidade de diamantes para converter em pontos' })
  @IsInt()
  @Min(1, { message: 'Minimo de 1 diamante para conversao' })
  diamonds: number;
}
