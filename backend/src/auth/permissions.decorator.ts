import { SetMetadata } from '@nestjs/common';

export const RequiresPermission = (perm: string) => SetMetadata('required_permission', perm);
