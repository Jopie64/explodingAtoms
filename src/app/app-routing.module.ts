import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExplodingAtomsComponent } from './exploding-atoms/exploding-atoms.component';

const routes: Routes = [
  { path: '', component: ExplodingAtomsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
