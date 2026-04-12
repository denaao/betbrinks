import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsInt, Min, IsOptional } from 'class-validator';

export class CreateLeagueDto {
  @ApiProperty({ example: 'Meus Amigos', description: 'Nome da liga (3-50 caracteres)' })
  @IsString()
  @MinLength(3, { message: 'Nome deve ter no mínimo 3 caracteres' })
  @MaxLength(50, { message: 'Nome deve ter no máximo 50 caracteres' })
  name: string;

  @ApiProperty({ example: 200, description: 'Diamantes para o caixa inicial da liga' })
  @IsInt({ message: 'Diamantes deve ser um número inteiro' })
  @Min(1, { message: 'Depósito inicial deve ser de pelo menos 1 diamante' })
  initialDiamonds: number;

  @ApiProperty({ example: 100, required: false, description: 'Alerta mínimo do caixa (em fichas). Padrão: 100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cashboxMinAlert?: number;
}
