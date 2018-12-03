import * as THREE from 'three';
import { Observable, combineLatest, OperatorFunction, defer, merge, timer } from 'rxjs';
import { msElapsed } from '../tools';
import { map, filter, take, scan, distinctUntilChanged,
  switchMap, refCount, publish, flatMap, publishReplay, takeUntil, takeWhile } from 'rxjs/operators';
import { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { makeAtomGame, AtomState, Atom } from '../atomGame';

export interface Vector2d {
    x: number;
    y: number;
}

export interface AtomSceneInput {
    windowSize$: Observable<Vector2d>;
    mouseMove$: Observable<MouseEvent>;
    mouseDown$: Observable<MouseEvent>;
    size: number;
    divisions: number;
}

export interface SceneState {
    scene: THREE.Scene;
    camera: THREE.Camera;
}

type InternalSceneAction = () => void;

interface MeshWithBehavior {
    mesh: THREE.Mesh;
    action$: Observable<InternalSceneAction>;
}

const meshEqualPred = (a: Mesh | null, b: Mesh | null): boolean => {
  if (a === null && b === null) { return true; }
  if (a === null || b === null) { return false; }
  return a.name === b.name;
};

const frame$ = msElapsed().pipe(
    scan<number, ({prev: number, diff: number, curr: number})>(({curr}, newCurr: number) => ({
      prev: curr,
      diff: newCurr - curr,
      curr: newCurr
    }), { prev: 0, diff: 0, curr: 0 }),
    map(({diff, curr}) => ({ diff, time: curr })),
    publish(), refCount());

const vectorAdd = (a: Vector2d, b: Vector2d): Vector2d => ({ x: b.x + a.x, y: b.y + a.y });
const vectorMult = (a: Vector2d, mult: number): Vector2d => ({ x: a.x * mult, y: a.y * mult });
const vectorDiff = (a: Vector2d, b: Vector2d): Vector2d => ({ x: b.x - a.x, y: b.y - a.y });
const vectorDistance2 = (diff: Vector2d) => {
    return diff.x * diff.x + diff.y * diff.y;
};
const vectorDistance = (diff: Vector2d) => Math.sqrt(vectorDistance2(diff));


export const buildAtomScene$ = ({ mouseMove$, mouseDown$, windowSize$, size, divisions }: AtomSceneInput): Observable<SceneState> => {

    const toScenePos = (() => {
        const planeSize = size / divisions;
        const bottom = -size / 2;
        const left = -size / 2;
        return ({x, y}: Vector2d): Vector2d => ({
          x: left + (x + .5) * planeSize,
          y: bottom + (y + .5) * planeSize
        });
      })();


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

    const cellSize = size / divisions;

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

    const makeAtomBehavior = (atom: Atom): MeshWithBehavior => {
        const geometry = new THREE.SphereGeometry(cellSize / 4, 32, 32);
        const material = new THREE.MeshLambertMaterial( { color: 0xffffff } );
        const mesh = new THREE.Mesh( geometry, material );

        let pos: Vector2d = { x: 0, y: 0 };
        let speed: Vector2d = { x: 0, y: 0 };

        return {
            mesh,
            action$: atom.state$.pipe(
                switchMap(atomState => {
                    const sPos = atomStateToPos(atomState);
                    let counter = 10;
                    return frame$.pipe(
                        map(({diff}) => {
                            const vdiff = vectorDiff(pos, sPos);
                            speed = vectorAdd(speed, vectorMult(vdiff, vectorDistance(vdiff) * diff / 1000));
                            speed = vectorMult(speed, 0.9);
                            pos = vectorAdd(pos, speed);
                            --counter;
                            return vdiff;
                        }),
                        takeWhile( vdiff => vectorDistance(vdiff) > 0.05 || vectorDistance(speed) > 0.1 || counter > 0),
                        map(() => () => {
                            material.color.setRGB(atomState.player === 0 ? 1 : 0, 0, atomState.player === 1 ? 1 : 0);
                            mesh.position.setX(pos.x);
                            mesh.position.setY(pos.y);
                        }));
                }))
        };
    };

    const initialScene$ = defer(async (): Promise<InternalSceneState> => {
      const atomGame = makeAtomGame(size, size);
      const scene = new THREE.Scene();
      scene.add( new THREE.AmbientLight( 0xa0a0a0, 0.35 )); // soft white light
      const light = new THREE.DirectionalLight( 0xffffff, 0.8 );
      light.position.set( 1, 1, 1 ).normalize();
      scene.add( light );

      const fieldGroup = new THREE.Group();
      const grid = new THREE.GridHelper( size, divisions, 0xffffff, 0xffff00 );
      grid.rotation.x = Math.PI / 2;

      fieldGroup.add(grid);

      const cellGroup = new THREE.Group();
      for (let y = 0; y < divisions; ++y) {
        for (let x = 0; x < divisions; ++x) {
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
            const { mesh, action$ } = makeAtomBehavior(atom);
            atomsGroup.add(mesh);
            return action$;
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
};
