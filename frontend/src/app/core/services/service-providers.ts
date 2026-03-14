import { Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { MockAuthService } from './mock-auth.service';
import { MockDataService } from './mock-data.service';
import { ApiAuthService } from './api-auth.service';
import { ApiDataService } from './api-data.service';

export function authServiceFactory(http: HttpClient): AuthService {
  return environment.useMock ? new MockAuthService() : new ApiAuthService(http);
}

export function dataServiceFactory(http: HttpClient): DataService {
  return environment.useMock ? new MockDataService() : new ApiDataService(http);
}

export const serviceProviders: Provider[] = [
  {
    provide: AuthService,
    useFactory: authServiceFactory,
    deps: [HttpClient],
  },
  {
    provide: DataService,
    useFactory: dataServiceFactory,
    deps: [HttpClient],
  },
];
