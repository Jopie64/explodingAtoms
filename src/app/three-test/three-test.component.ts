import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable } from 'rxjs';
import { msElapsed } from '../tools';
import { map } from 'rxjs/operators';

// Following this example: https://stackoverflow.com/questions/40273300/angular-cli-threejs

interface Pos {
  x: number;
  y: number;
}

@Component({
  selector: 'app-three-test',
  templateUrl: './three-test.component.html',
  styleUrls: ['./three-test.component.css']
})
export class ThreeTestComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  rayCaster = new THREE.Raycaster();
  scene = null;
  camera = null;
  fieldGrid = null;

  nFrame = 0;

  mouseMove$: Observable<MouseEvent>;
  mouseDown$: Observable<MouseEvent>;
  mouseUp$: Observable<MouseEvent>;

  clientToScene: (e: MouseEvent) => Pos;

  cons = new Subscription();

  constructor() {
    this.scene = new THREE.Scene();
    this.onResize();

    const geometry = new THREE.BoxGeometry(200, 200, 200);
    const material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
    // this.mesh = new THREE.Mesh(geometry, material);

    // this.scene.add(this.mesh);

    this.buildScene();
  }

  ngOnInit() {
  }

  buildScene() {
    this.scene.add( new THREE.AmbientLight( 0x404040, 0.3 )); // soft white light
    const light = new THREE.DirectionalLight( 0xffffff, 0.35 );
    light.position.set( 1, 1, 1 ).normalize();
    this.scene.add( light );

    const size = 10;
    const divisions = 10;
    this.fieldGrid = new THREE.GridHelper( size, divisions, 0xffff00, 0xffff00 );
    this.fieldGrid.rotation.x = Math.PI / 2;
    this.scene.add( this.fieldGrid );

    const geometry = new THREE.SphereGeometry( 2, 32, 32 );
    const material = new THREE.MeshLambertMaterial( {color: 0xff0000} );
    const sphere = new THREE.Mesh( geometry, material );
    this.scene.add( sphere );
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight - 4;
    console.log(`Resizing... (${width}x${height})`);
    this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    this.camera.position.z = 10;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    this.clientToScene = (e: MouseEvent) => ({
      x:   ( e.clientX / window.innerWidth ) * 2 - 1,
      y: - ( e.clientY / window.innerHeight ) * 2 + 1
    });
  }

  ngOnDestroy() {
    this.cons.unsubscribe();
  }

  ngAfterViewInit() {
    this.mouseMove$ = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    this.mouseDown$ = fromEvent(this.rendererContainer.nativeElement, 'mousedown');
    this.mouseUp$ = fromEvent(this.rendererContainer.nativeElement, 'mouseup');
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.cons.add(msElapsed().subscribe(time => this.animate(time)));
    this.cons.add(this.mouseMove$.pipe(
      map(v => this.clientToScene(v)),
      map(v =>  {
        this.rayCaster.setFromCamera(v, this.camera);
        return this.rayCaster.intersectObjects(this.scene.children);
        return v;
      }))
      .subscribe(v => console.log('*** Mouse move', v)));
  }

  animate(time: number) {
    ++this.nFrame;
    // this.fieldGrid.rotation.x = time / 1000;
    this.fieldGrid.rotation.z = Math.sin(time / 5000) / 3;
    this.fieldGrid.rotation.x = Math.PI / 2 + Math.sin(time / 7000) / 4;
    this.renderer.render(this.scene, this.camera);
  }
}
