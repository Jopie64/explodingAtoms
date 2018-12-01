import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable, BehaviorSubject, combineLatest, OperatorFunction, Subject, of, defer, merge } from 'rxjs';
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

@Component({
  selector: 'app-three-test',
  templateUrl: './three-test.component.html',
  styleUrls: ['./three-test.component.css']
})
export class ThreeTestComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  camera: THREE.Camera;

  nFrame = 0;

  windowSize$ = new BehaviorSubject<Vector2d>({x: 0, y: 0});

  mouseMoveScene$: Observable<Vector2d>;

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
    const mouseMove$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    const mouseDown$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousedown');
    const mouseUp$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mouseup');

    const frame$ = msElapsed().pipe(
      scan<number, ({prev: number, diff: number, curr: number})>(({prev, diff, curr}, newCurr: number) => ({
        prev: curr,
        diff: newCurr - curr,
        curr: newCurr
      }), { prev: 0, diff: 0, curr: 0 }),
      map(({diff, curr}) => ({ diff, time: curr })),
      publish(), refCount());

    const rayCaster = new THREE.Raycaster();
    const pointToMesh = (group: Object3D): OperatorFunction<Vector2d, Mesh | null> => in$ => in$.pipe(
        map(v => {
          rayCaster.setFromCamera(v, this.camera);
          return rayCaster.intersectObjects(group.children);
        }),
        map(v => v.length > 0 && v[0].object instanceof Mesh ? v[0].object : null),
        distinctUntilChanged(meshEqualPred));

    const mouseToScenePos = (event: MouseEvent, wndSize: Vector2d) => ({
      x:   ( event.clientX / wndSize.x ) * 2 - 1,
      y: - ( event.clientY / wndSize.y ) * 2 + 1
    });

    const mouseMoveScene$ = combineLatest(
      mouseMove$, this.windowSize$.pipe(filter(v => v.x > 0)), frame$,
      mouseToScenePos
    );

    interface InternalSceneState {
      scene: THREE.Scene;
      action$: Observable<InternalSceneAction>;
    }

    type InternalSceneAction = () => void;

    const initialScene$ = defer(async (): Promise<InternalSceneState> => {
      const atomGame = makeAtomGame(SIZE, SIZE);
      const scene = new THREE.Scene();
      scene.add( new THREE.AmbientLight( 0xa0a0a0, 0.35 )); // soft white light
      const light = new THREE.DirectionalLight( 0xffffff, 0.8 );
      light.position.set( 1, 1, 1 ).normalize();
      scene.add( light );

      const fieldGroup = new THREE.Group();
      const grid = new THREE.GridHelper( SIZE, DIVISIONS, 0xffffff, 0xffff00 );
      grid.rotation.x = Math.PI / 2;

      fieldGroup.add(grid);

      const cellGroup = new THREE.Group();
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
          cellGroup.add(mesh);
        }
      }

      fieldGroup.add(cellGroup);

      scene.add(fieldGroup);

      const onCelClicked$ = mouseDown$.pipe(
        switchMap(mouseEvent => this.windowSize$.pipe(
          map(wndSize => mouseToScenePos(mouseEvent, wndSize)),
          pointToMesh(cellGroup),
          take(1))
        ),
        // tslint:disable-next-line:no-non-null-assertion
        filter(v => v != null), map(v => v!),
        map(v => JSON.parse(v.name).plane as Vector2d));

      const currHover$ = mouseMoveScene$.pipe(
        pointToMesh(cellGroup),
        map(v => v ? v.name : ''));

      // Handle mouse clicks
      const addAtomToGameAction$ = onCelClicked$.pipe(
        map(v => () => {
          console.log('clicked', v);
          atomGame.addAtom(v);
        }));

      // Handle game events
      const atomsGroup = new THREE.Group();
      fieldGroup.add(atomsGroup);

      const addAtomToScreenAction$ = atomGame.onNewAtom$.pipe(
        map(atom => () => {
          const geometry = new THREE.SphereGeometry(planeSize / 4, 32, 32);
          const material = new THREE.MeshLambertMaterial( {color: atom.player === 0 ? 0xff0000 : 0x0000ff} );
          const sphere = new THREE.Mesh( geometry, material );

          this.cons.add(atom.pos$.subscribe(pos => {
            const sPos = toScenePos(pos);
            sphere.position.setX(sPos.x);
            sphere.position.setY(sPos.y);
          }));
          atomsGroup.add(sphere);
      }));

      const rotateFieldAction$ = frame$.pipe(
        map(({time}) => () => {
          ++this.nFrame;
          fieldGroup.rotation.y = Math.sin(time / 5000) / 3;
          fieldGroup.rotation.x = Math.sin(time / 7000) / 4;
        }));

      // highlight hovered items
      const highlightHoverAction$ = combineLatest(currHover$, frame$).pipe(
        map(([currHover, {diff}]) => () =>
          cellGroup.children.forEach(cel => {
            if (cel instanceof Mesh && cel.material instanceof MeshLambertMaterial) {
              if (cel.name !== currHover) {
                cel.material.opacity *= Math.pow(.998, diff);
              } else {
                cel.material.opacity = 1;
              }
            }
          })
        ));

      return {
        scene,
        action$: merge(
          addAtomToGameAction$,
          addAtomToScreenAction$,
          rotateFieldAction$,
          highlightHoverAction$
        )
      };
    });

    const scene$ = initialScene$.pipe(
      switchMap(initialScene => initialScene.action$.pipe(
        scan((scene: InternalSceneState, action: InternalSceneAction) => {
          action();
          return scene;
        }, initialScene)
      )));

    return scene$.pipe(map(({scene}) => ({scene, camera: this.camera })));
  }
}
