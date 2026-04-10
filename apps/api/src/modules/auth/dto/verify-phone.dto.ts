import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  @Matches(/^\+55\d{10,11}$/)
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Codigo OTP deve ter 6 digitos' })
  @Matches(/^\d{6}$/, { message: 'Codigo deve conter apenas numeros' })
  code: string;
}
