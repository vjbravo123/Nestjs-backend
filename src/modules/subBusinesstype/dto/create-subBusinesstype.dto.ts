import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateSubBusinessTypeDto {
  @IsMongoId({ message: 'businessType must be a valid ObjectId' })
  businessType: string;
        
  @IsString()
  @IsNotEmpty()
  name: string;
}


