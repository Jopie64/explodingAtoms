# Exploding Atoms ⚛️💥

An interactive 3D chain reaction game built as a playground to experiment with **reactive programming** and **3D web graphics**.

---

## 💡 Overview & Purpose

The primary goal of **Exploding Atoms** is to explore the intersection of **RxJS (Reactive Extensions for JavaScript)** and **Three.js (3D WebGL rendering)** within an Angular application.

Instead of traditional imperative event loops, game state transformations, mouse interactions, animations, and chain reaction explosions are modeled cleanly as reactive streams of data.

---

## 🎮 Game Rules & Mechanics

- **Grid Layout**: A 3D interactive $10 \times 10$ grid.
- **Taking Turns**: Players take turns clicking on grid cells to add atoms.
- **Critical Mass & Chain Reactions**:
  - Each cell has a capacity determined by its number of adjacent neighbors.
  - Corner cells explode at **2 atoms**, edge cells at **3 atoms**, and interior cells at **4 atoms**.
  - When a cell reaches critical mass, it **explodes**, distributing its atoms into neighboring cells and taking ownership of those cells.
  - Explosions can trigger chain reactions across the board!

---

## 🛠️ Tech Stack

- **Framework**: [Angular 21](https://angular.dev/)
- **Reactive Stream Engine**: [RxJS 7](https://rxjs.dev/)
- **3D Graphics & WebGL**: [Three.js 0.185.1](https://threejs.org/)
- **Language**: TypeScript 5.9


---

## 🚀 Getting Started

### Prerequisites

- Node.js `^18.19.0` or `^20.9.0` or `^22.0.0`
- npm `^10.0.0`

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Jopie64/explodingAtoms.git
cd explodingAtoms
npm install
```

### Development Server

Run the development server:

```bash
npm start
```

Navigate to `http://localhost:4200/` in your browser. The app automatically reloads if any source files are modified.

### Production Build

Build the project for production:

```bash
npm run build
```

The build artifacts will be stored in the `dist/explodingAtoms/` directory.

---

## 📄 License

MIT License.
