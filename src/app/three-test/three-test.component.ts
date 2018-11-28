import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable, BehaviorSubject, combineLatest, OperatorFunction, Subject, of } from 'rxjs';
import { msElapsed } from '../tools';
import { map, filter, tap, take, scan, distinctUntilChanged, switchMap, refCount, publish, mapTo } from 'rxjs/operators';
import { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { makeAtomGame } from '../atomGame';

// Following this example: https://stackoverflow.com/questions/40273300/angular-cli-threejs

interface Vector2d {
  x: number;
  y: number;
}

interface SceneState {
  scene: THREE.Scene;
  camera: THREE.Camera;
}

const SIZE = 10;
const DIVISIONS = 10;

const toScenePos = (() => {
  const planeSize = SIZE / DIVISIONS;
  const bottom = -SIZE / 2;
  const left = -SIZE / 2;
  return ({x, y}: Vector2d): Vector2d => ({
    x: left + (x + .5) * planeSize,
    y: bottom + (y + .5) * planeSize
  });
})();

const meshEqualPred = (a: Mesh | null, b: Mesh | null): boolean => {
  if (a === null && b === null) { return true; }
  if (a === null || b === null) { return false; }
  return a.name === b.name;
};

const frame$ = msElapsed().pipe(
  scan<number, ({prev: number, diff: number, curr: number})>(({prev, diff, curr}, newCurr: number) => ({
    prev: curr,
    diff: newCurr - curr,
    curr: newCurr
  }), { prev: 0, diff: 0, curr: 0 }),
  map(({diff, curr}) => ({ diff, time: curr })),
  publish(), refCount());

@Component({
  selector: 'app-three-test',
  templateUrl: './three-test.component.html',
  styleUrls: ['./three-test.component.css']
})
export class ThreeTestComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  rayCaster = new THREE.Raycaster();
  camera: THREE.Camera;
  fieldGeometry: Object3D;
  cellsGeometry: Object3D;

  atoms = new THREE.Group();

  nFrame = 0;
  currHover = '';

  mouseMove$: Observable<MouseEvent>;
  mouseDown$: Observable<MouseEvent>;
  mouseUp$: Observable<MouseEvent>;
  windowSize$ = new BehaviorSubject<Vector2d>({x: 0, y: 0});
  onAnimate$ = new Subject<{time: number, diff: number}>();

  mouseMoveScene$: Observable<Vector2d>;

  atomGame = makeAtomGame(SIZE, SIZE);

  cons = new Subscription();

  constructor() {
    this.onResize();

  }


  ngAfterViewInit() {
    const renderer$ = of(new THREE.WebGLRenderer({ antialias: true })).pipe(
      tap(renderer => this.rendererContainer.nativeElement.appendChild(renderer.domElement)),
      switchMap(renderer => this.windowSize$.pipe(
        tap(({x, y}) => renderer.setSize(x, y)),
        mapTo(renderer)
      ))
    );
    this.cons.add(combineLatest(renderer$, this.buildScene$()).subscribe(([renderer, v]) => {
      renderer.render(v.scene, v.camera);
    }));
  }


  pointToMesh(group: Object3D): OperatorFunction<Vector2d, Mesh | null> {
    return in$ => in$.pipe(
      map(v => {
        this.rayCaster.setFromCamera(v, this.camera);
        return this.rayCaster.intersectObjects(group.children);
      }),
      map(v => v.length > 0 && v[0].object instanceof Mesh ? v[0].object : null),
      distinctUntilChanged(meshEqualPred));
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
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    camera.position.z = 10;
    camera.updateProjectionMatrix();
    this.camera = camera;

    this.windowSize$.next({x: width, y: height});
  }


  buildScene$(): Observable<SceneState> {
    const scene = new THREE.Scene();
    scene.add( new THREE.AmbientLight( 0xa0a0a0, 0.8 )); // soft white light
    const light = new THREE.DirectionalLight( 0xffffff, 0.35 );
    light.position.set( 1, 1, 1 ).normalize();
    scene.add( light );

    const fieldGroup = new THREE.Group();
    const grid = new THREE.GridHelper( SIZE, DIVISIONS, 0xffffff, 0xffff00 );
    grid.rotation.x = Math.PI / 2;

    fieldGroup.add(grid);

    const celGroup = new THREE.Group();
    const planeSize = SIZE / DIVISIONS;
    for (let y = 0; y < DIVISIONS; ++y) {
      for (let x = 0; x < DIVISIONS; ++x) {
        const material = new THREE.MeshLambertMaterial( {color: 0x00ff00, transparent: true, opacity: 1} );
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const mesh = new THREE.Mesh(geometry, material);
        const pos = toScenePos({x, y});
        mesh.position.setX(pos.x);
        mesh.position.setY(pos.y);
        mesh.name = JSON.stringify({plane: {x, y}});
        celGroup.add(mesh);
      }
    }

    console.log(celGroup);
    fieldGroup.add(celGroup);
    fieldGroup.add(this.atoms);

    this.cellsGeometry = celGroup;
    this.fieldGeometry = fieldGroup;

    scene.add(fieldGroup);

    this.mouseMove$ = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    this.mouseDown$ = fromEvent(this.rendererContainer.nativeElement, 'mousedown');
    this.mouseUp$ = fromEvent(this.rendererContainer.nativeElement, 'mouseup');

    const mouseToScenePos = (event: MouseEvent, wndSize: Vector2d) => ({
      x:   ( event.clientX / wndSize.x ) * 2 - 1,
      y: - ( event.clientY / wndSize.y ) * 2 + 1
    });
    this.mouseMoveScene$ = combineLatest(
      this.mouseMove$, this.windowSize$.pipe(filter(v => v.x > 0)), this.onAnimate$,
      mouseToScenePos
    );

    const onCelClicked$ = this.mouseDown$.pipe(
      switchMap(mouseEvent => this.windowSize$.pipe(
        map(wndSize => mouseToScenePos(mouseEvent, wndSize)),
        this.pointToMesh(this.cellsGeometry),
        take(1))
      ),
      // tslint:disable-next-line:no-non-null-assertion
      filter(v => v != null), map(v => v!),
      map(v => JSON.parse(v.name).plane as Vector2d));

    // Handle mouse moves
    this.cons.add(this.mouseMoveScene$.pipe(
      this.pointToMesh(this.cellsGeometry))
      .subscribe(v => {
        if (v && v.material instanceof MeshLambertMaterial) {
          console.log('Object content: ', v.name);
          this.currHover = v.name;
          v.material.opacity = 1;
        } else {
          this.currHover = '';
        }
      }));

    // Handle mouse clicks
    this.cons.add(onCelClicked$.subscribe(v => {
      console.log('clicked', v);
      this.atomGame.addAtom(v);
    }));

    // Handle game events
    this.cons.add(this.atomGame.onNewAtom$.subscribe(atom => {

      const geometry = new THREE.SphereGeometry(planeSize / 4, 32, 32);
      const material = new THREE.MeshLambertMaterial( {color: atom.player === 0 ? 0xff0000 : 0x0000ff} );
      const sphere = new THREE.Mesh( geometry, material );

      this.cons.add(atom.pos$.subscribe(pos => {
        const sPos = toScenePos(pos);
        sphere.position.setX(sPos.x);
        sphere.position.setY(sPos.y);
      }));
      this.atoms.add(sphere);
    }));

    return frame$.pipe(
      map(({time, diff}) => {
      ++this.nFrame;
      // this.fieldGrid.rotation.x = time / 1000;
      this.fieldGeometry.rotation.y = Math.sin(time / 5000) / 3;
      this.fieldGeometry.rotation.x = Math.sin(time / 7000) / 4;

      this.cellsGeometry.children.forEach(cel => {
        if (cel instanceof Mesh && cel.material instanceof MeshLambertMaterial) {
          if (cel.name !== this.currHover) {
            cel.material.opacity *= Math.pow(.998, diff);
          }
        }
      });
      this.onAnimate$.next({time, diff});
      return {scene, camera: this.camera };
    }));
  }

}
