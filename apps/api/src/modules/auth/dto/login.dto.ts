import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, { message: 'CPF deve estar no formato 12345678901 ou 123.456.789-01' })
  cpf: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  password: string;
}
