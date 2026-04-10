import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class TransferBalanceDto {
  @ApiProperty({ example: 5, description: 'ID do usuário para transferência' })
  @IsInt()
  @Min(1)
  targetUserId: number;

  @ApiProperty({ example: 100, description: 'Quantidade de pontos para transferir' })
  @IsInt()
  @Min(1, { message: 'Quantidade deve ser no mínimo 1 ponto' })
  amount: number;
}
