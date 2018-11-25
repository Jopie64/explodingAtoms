import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription } from 'rxjs';
import { msElapsed } from '../tools';

// Following this example: https://stackoverflow.com/questions/40273300/angular-cli-threejs

@Component({
  selector: 'app-three-test',
  templateUrl: './three-test.component.html',
  styleUrls: ['./three-test.component.css']
})
export class ThreeTestComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  renderer = new THREE.WebGLRenderer();
  scene = null;
  camera = null;
  mesh = null;

  width: number;
  height: number;

  nFrame = 0;

  cons = new Subscription();

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight - 4;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 1, 10000);
    this.camera.position.z = 500;

    const geometry = new THREE.BoxGeometry(200, 200, 200);
    const material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
    this.mesh = new THREE.Mesh(geometry, material);

    this.scene.add(this.mesh);
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.cons.unsubscribe();
  }

  ngAfterViewInit() {
    this.renderer.setSize(this.width, this.height);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.cons.add(msElapsed().subscribe(time => this.animate(time)));
  }

  animate(time: number) {
    ++this.nFrame;
    this.mesh.rotation.x = time / 1000;
    this.mesh.rotation.y = time / 500;
    this.renderer.render(this.scene, this.camera);
  }
}
