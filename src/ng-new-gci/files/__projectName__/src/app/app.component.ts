import { Component, OnInit } from '@angular/core';
import { AppConfig } from './models/app-config.model';
import { AppConfigService } from './services/app-config.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = '<%= projectName %>';
  private env: string | undefined;

  constructor(private appConfigService: AppConfigService) {}

  ngOnInit(): void {
    this.appConfigService.loadAppConfig().then((data: AppConfig) => {
      this.env = data.urls.test;
    });
  }
}
