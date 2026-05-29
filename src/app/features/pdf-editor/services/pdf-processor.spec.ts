import { TestBed } from '@angular/core/testing';

import { PdfProcessor } from './pdf-processor';

describe('PdfProcessor', () => {
  let service: PdfProcessor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfProcessor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
