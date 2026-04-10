import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ConvertDiamondsLeagueDto {
  @ApiProperty({ example: 100, description: 'Quantidade de diamantes para converter em saldo da liga' })
  @IsInt()
  @Min(1, { message: 'Mínimo de 1 diamante para conversão' })
  diamonds: number;
}
