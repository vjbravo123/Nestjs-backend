import { IsNotEmpty } from 'class-validator';
import { IsMongoId } from 'class-validator';

export class AddFromDraftParams {
  @IsNotEmpty({ message: 'draftId must not be empty' })
  @IsMongoId({ message: 'draftId must be a valid MongoDB ObjectId' })
  draftId: string;
}
