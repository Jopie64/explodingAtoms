import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ThreeTestComponent } from './three-test/three-test.component';

const routes: Routes = [
  { path: '', component: ThreeTestComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
