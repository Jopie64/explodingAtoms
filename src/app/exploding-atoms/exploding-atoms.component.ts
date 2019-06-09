import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable, BehaviorSubject,
  combineLatest, of, Subject } from 'rxjs';
import { tap, switchMap, mapTo } from 'rxjs/operators';
import { Vector2d, buildAtomScene$, AtomSceneInput } from './atomScene';

// Following this example: https://stackoverflow.com/questions/40273300/angular-cli-threejs



@Component({
  selector: 'app-exploding-atoms',
  templateUrl: './exploding-atoms.component.html',
  styleUrls: ['./exploding-atoms.component.css']
})
export class ExplodingAtomsComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer', { static: true }) rendererContainer: ElementRef;

  nFrame = 0;

  windowSize$ = new BehaviorSubject<Vector2d>({x: 0, y: 0});

  cons = new Subscription();
  keyPress$ = new Subject<KeyboardEvent>();

  constructor() {
    this.onResize();

  }

  ngAfterViewInit() {
    const mouseMove$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    const mouseDown$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousedown');

    const atomSceneInput: AtomSceneInput = {
      windowSize$: this.windowSize$,
      mouseMove$,
      mouseDown$,
      keyPress$: this.keyPress$,
      size: 10,
      divisions: 10
    };

    const renderer$ = of(new THREE.WebGLRenderer({ antialias: true })).pipe(
      tap(renderer => this.rendererContainer.nativeElement.appendChild(renderer.domElement)),
      switchMap(renderer => this.windowSize$.pipe(
        tap(({x, y}) => renderer.setSize(x, y)),
        mapTo(renderer)
      ))
    );
    this.cons.add(combineLatest(renderer$, buildAtomScene$(atomSceneInput)).subscribe(([renderer, v]) => {
      renderer.render(v.scene, v.camera);
    }));
  }


  ngOnInit() {
  }

  ngOnDestroy() {
    this.cons.unsubscribe();
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight - 4;
    console.log(`Resizing... (${width}x${height})`);
    this.windowSize$.next({x: width, y: height});
  }
}
