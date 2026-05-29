import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadZone } from './upload-zone';

describe('UploadZone', () => {
  let component: UploadZone;
  let fixture: ComponentFixture<UploadZone>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadZone],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadZone);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
