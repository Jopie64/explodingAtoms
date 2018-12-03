import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExplodingAtomsComponent } from './exploding-atoms.component';

describe('ExplodingAtomsComponent', () => {
  let component: ExplodingAtomsComponent;
  let fixture: ComponentFixture<ExplodingAtomsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ExplodingAtomsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExplodingAtomsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
