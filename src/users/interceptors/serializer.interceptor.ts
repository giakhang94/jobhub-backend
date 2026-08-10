import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { map, Observable } from 'rxjs';

@Injectable()
export class SerializerInterceptor implements NestInterceptor {
  private readonly BLACKLIST_FIELDS = [
    'password',
    'refreshTokenHash',
    'emailVerificationToken',
    'emailVerificationTokenExpiry',
  ];
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //before here request goes to the controller

    //use next.handle() to allow request to go to the controller -> service and
    // next.handle() return a raw data with type of observable
    // use .pipe() method to catch the out coming data before it send to  client through the response
    return next.handle().pipe(
      map((data: any) => {
        return this.cleanSensitiveData(data);
      }),
    );
  }
  //clean sensitive data function
  private cleanSensitiveData(data: any) {
    if (
      data === null ||
      data === undefined ||
      typeof data !== 'object' ||
      data instanceof Date
    ) {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((res: any) => this.cleanSensitiveData(res));
    }
    if (typeof data == 'object' && !Array.isArray(data)) {
      const cleanedObject = { ...data };
      const keysArray = Object.keys(cleanedObject);
      for (const key of keysArray) {
        if (this.BLACKLIST_FIELDS.includes(key)) {
          delete cleanedObject[key];
        } else if (
          typeof cleanedObject[key] === 'object' &&
          cleanedObject[key] !== null
        ) {
          cleanedObject[key] = this.cleanSensitiveData(cleanedObject[key]);
        }
      }
      return cleanedObject;
    }
    return data;
  }
}
