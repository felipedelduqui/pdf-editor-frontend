import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DrawingCanvas } from './drawing-canvas';

describe('DrawingCanvas', () => {
  let component: DrawingCanvas;
  let fixture: ComponentFixture<DrawingCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawingCanvas],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
