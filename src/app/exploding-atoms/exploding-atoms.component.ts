import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable, BehaviorSubject,
  combineLatest, OperatorFunction, of, defer, merge, timer } from 'rxjs';
import { msElapsed } from '../tools';
import { map, filter, tap, take, scan, distinctUntilChanged,
  switchMap, refCount, publish, mapTo, flatMap, publishReplay } from 'rxjs/operators';
import { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { makeAtomGame, AtomState } from '../atomGame';

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

interface AtomSceneInput {
  windowSize$: Observable<Vector2d>;
  mouseMove$: Observable<MouseEvent>;
  mouseDown$: Observable<MouseEvent>;
}

@Component({
  selector: 'app-exploding-atoms',
  templateUrl: './exploding-atoms.component.html',
  styleUrls: ['./exploding-atoms.component.css']
})
export class ExplodingAtomsComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  nFrame = 0;

  windowSize$ = new BehaviorSubject<Vector2d>({x: 0, y: 0});

  cons = new Subscription();

  constructor() {
    this.onResize();

  }

  ngAfterViewInit() {
    const mouseMove$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    const mouseDown$: Observable<MouseEvent> = fromEvent(this.rendererContainer.nativeElement, 'mousedown');
    const atomSceneInput: AtomSceneInput = {
      windowSize$: this.windowSize$,
      mouseMove$,
      mouseDown$
    };

    const renderer$ = of(new THREE.WebGLRenderer({ antialias: true })).pipe(
      tap(renderer => this.rendererContainer.nativeElement.appendChild(renderer.domElement)),
      switchMap(renderer => this.windowSize$.pipe(
        tap(({x, y}) => renderer.setSize(x, y)),
        mapTo(renderer)
      ))
    );
    this.cons.add(combineLatest(renderer$, this.buildScene$(atomSceneInput)).subscribe(([renderer, v]) => {
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

  buildScene$({ mouseMove$, mouseDown$, windowSize$ }: AtomSceneInput): Observable<SceneState> {

    const frame$ = msElapsed().pipe(
      scan<number, ({prev: number, diff: number, curr: number})>(({prev, diff, curr}, newCurr: number) => ({
        prev: curr,
        diff: newCurr - curr,
        curr: newCurr
      }), { prev: 0, diff: 0, curr: 0 }),
      map(({diff, curr}) => ({ diff, time: curr })),
      publish(), refCount());

    const camera$ = windowSize$.pipe(
      map(({x, y}) => {
        const camera = new THREE.PerspectiveCamera(75, x / y, 1, 10000);
        camera.position.z = 10;
        camera.updateProjectionMatrix();
        return camera;
      }),
      publishReplay(1), refCount());

    const rayCaster = new THREE.Raycaster();
    const pointToMesh = (group: Object3D): OperatorFunction<Vector2d, Mesh | null> => point$ =>
      combineLatest(point$, camera$).pipe(
        map(([point, camera]) => {
          rayCaster.setFromCamera(point, camera);
          return rayCaster.intersectObjects(group.children);
        }),
        map(v => v.length > 0 && v[0].object instanceof Mesh ? v[0].object : null),
        distinctUntilChanged(meshEqualPred));

    const mouseToScenePos = (event: MouseEvent, wndSize: Vector2d) => ({
      x:   ( event.clientX / wndSize.x ) * 2 - 1,
      y: - ( event.clientY / wndSize.y ) * 2 + 1
    });

    const mouseMoveScene$ = combineLatest(
      mouseMove$, windowSize$.pipe(filter(v => v.x > 0)), frame$,
      mouseToScenePos
    );

    interface InternalSceneState {
      scene: THREE.Scene;
      action$: Observable<InternalSceneAction>;
    }

    const cellSize = SIZE / DIVISIONS;

    const atomStateToPos = (a: AtomState) => {
      const offset = cellSize / 4;
      const sp = toScenePos(a);
      switch (a.ix) {
        case 0: return { x: sp.x - offset, y: sp.y };
        case 1: return { x: sp.x, y: sp.y + offset };
        case 2: return { x: sp.x + offset, y: sp.y };
        case 3: return { x: sp.x, y: sp.y - offset };
        default: return { x: sp.x + (1 - 2 * Math.random()) * offset, y: sp.y + (1 - 2 * Math.random()) * offset };
      }
    };

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
      for (let y = 0; y < DIVISIONS; ++y) {
        for (let x = 0; x < DIVISIONS; ++x) {
          const material = new THREE.MeshLambertMaterial( {color: 0x00ff00, transparent: true, opacity: 1} );
          const geometry = new THREE.PlaneGeometry(cellSize, cellSize);
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
        switchMap(mouseEvent => windowSize$.pipe(
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
        filter(v => atomGame.canAddAtom(v)),
        map(v => () => atomGame.addAtom(v)));

      // Handle game events
      const atomsGroup = new THREE.Group();
      fieldGroup.add(atomsGroup);

      const atomActions$ = atomGame.onNewAtom$.pipe(
        flatMap(atom => {
          const geometry = new THREE.SphereGeometry(cellSize / 4, 32, 32);
          const material = new THREE.MeshLambertMaterial( { color: 0xffffff } );
          const sphere = new THREE.Mesh( geometry, material );
          atomsGroup.add(sphere);

          return atom.state$.pipe(
            map(atomState => () => {
              const sPos = atomStateToPos(atomState);
              material.color.setRGB(atomState.player === 0 ? 1 : 0, 0, atomState.player === 1 ? 1 : 0);
              sphere.position.setX(sPos.x);
              sphere.position.setY(sPos.y);
          }));
      }));

      const rotateFieldAction$ = frame$.pipe(
        map(({time}) => () => {
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

      const explodeAction$ = timer(1000, 1000).pipe(
        map(_ => () => atomGame.explode()));

      return {
        scene,
        action$: merge(
          explodeAction$,
          addAtomToGameAction$,
          atomActions$,
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

    return combineLatest(scene$, camera$).pipe(map(([{scene}, camera]) => ({ scene, camera })));
  }
}
