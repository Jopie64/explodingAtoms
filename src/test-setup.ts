import '@analogjs/vitest-angular/setup-zone';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Mock WebGL context for Three.js in JSDOM environment
HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: any[]) {
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    const baseContext: Record<string, any> = {
      canvas: this,
      getExtension: () => null,
      getParameter: () => 'WebGL 1.0',
      getShaderPrecisionFormat: () => ({ precision: 24, rangeMin: 127, rangeMax: 127 }),
      createTexture: () => ({}),
      createBuffer: () => ({}),
      createProgram: () => ({}),
      createShader: () => ({}),
      getProgramParameter: () => true,
      getShaderParameter: () => true,
    };

    return new Proxy(baseContext, {
      get(target, prop: string) {
        if (prop in target) {
          return target[prop];
        }
        return () => {};
      },
    }) as any;
  }
  return null;
};
