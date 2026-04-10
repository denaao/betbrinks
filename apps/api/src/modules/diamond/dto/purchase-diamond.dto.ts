import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseDiamondDto {
  @ApiProperty({ example: 'starter', description: 'Diamond package ID' })
  @IsString()
  @IsIn(['starter', 'popular', 'pro', 'vip'], { message: 'Pacote invalido.' })
  packageId: string;

  @ApiProperty({ example: 'google_play', description: 'Platform: google_play or app_store' })
  @IsString()
  @IsIn(['google_play', 'app_store'], { message: 'Plataforma invalida.' })
  platform: string;

  @ApiProperty({ example: 'GPA.xxx-yyy', description: 'Store purchase receipt/token' })
  @IsString()
  storeReceipt: string;
}
