import { AppConfig } from '../models/app-config.model';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private appConfig: AppConfig | undefined;
  private configWarningCalled = false;

  constructor(private http: HttpClient) {}

  async loadAppConfig(): Promise<any> {
    const data = await this.http.get<AppConfig>('./config.json').toPromise();
    console.log('config', data);
    this.appConfig = data;
    return Promise.resolve(data);
  }

  get config() {
    if (!this.appConfig && !this.configWarningCalled) {
      console.error('No Config Found!');
      this.configWarningCalled = true;
    }
    return { ...this.appConfig } as AppConfig;
  }
}
