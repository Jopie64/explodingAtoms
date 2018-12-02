import { Observable, Subject, empty, BehaviorSubject } from 'rxjs';

export interface AtomPos {
    x: number;
    y: number;
}

export interface AtomIx {
    ix: number;
}

export interface AtomPlayer {
    player: number;
}

export type AtomState = AtomPos & AtomIx & AtomPlayer;

export interface Atom {
    state$: Observable<AtomState>;
}

export interface AtomGame {
    onNewAtom$: Observable<Atom>;
    addAtom(pos: AtomPos): Atom;
    canAddAtom(pos: AtomPos): boolean;
    explode(): void;
}

interface InternalAtom {
    player: number;
    state$: BehaviorSubject<AtomState>;
}

export const makeAtomGame = (sx: number, sy: number): AtomGame => {
    const onNewAtom$ = new Subject<Atom>();
    let player = 0;

    const toIx = ({x, y}: AtomPos) => y * sx + x;
    const isEdgeX = x => x === 0 || x === sx - 1;
    const isEdgeY = y => y === 0 || y === sy - 1;
    const field: InternalAtom[][] = [];

    // Initialize empty cells
    for (let i = 0; i < sx * sy; ++i) {
        field.push([]);
    }

    const addAtom = (pos: AtomPos): Atom => {
        const cel = field[toIx(pos)];
        const newAtom = {
            player,
            state$: new BehaviorSubject<AtomState>({ ...pos, ix: cel.length, player })
        };
        cel.push(newAtom);
        onNewAtom$.next(newAtom);
        ++player;
        player %= 2;
        return newAtom;
    };

    const moveAtom = (from: AtomPos, to: AtomPos) => {
        const celFrom = field[toIx(from)];
        const celTo   = field[toIx(to)];
        // tslint:disable-next-line:no-non-null-assertion
        const atom = celFrom.pop()!;
        celTo.push(atom);
        celTo.forEach((i, ix) => {
            i.player = atom.player;
            i.state$.next({ ...to, ix, player: i.player });
        });
    };

    const canAddAtom = (pos: AtomPos) => {
        const cell = field[toIx(pos)];
        return (cell.length === 0
            || cell[0].player === player)
            && getExplosiveCells().length === 0;
    };

    const getExplosiveCells = () => {
        const explodeCells: AtomPos[] = [];
        for (let y = 0; y < sy; ++y) {
            for (let x = 0; x < sx; ++x) {
                const cell = field[toIx({x, y})];
                const maxAtoms = 4 - (isEdgeX(x) ? 1 : 0) - (isEdgeY(y) ? 1 : 0);
                if (cell.length >= maxAtoms) {
                    console.log('Exploding', cell);
                    explodeCells.push({x, y});
                }
            }
        }
        return explodeCells;
    };

    const explode = () => getExplosiveCells().forEach(({x, y}) => {
        if (x < sx - 1) { moveAtom({x, y}, {x: x + 1, y}); }
        if (y < sy - 1) { moveAtom({x, y}, {x: x, y: y + 1 }); }
        if (x > 0)      { moveAtom({x, y}, {x: x - 1, y}); }
        if (y > 0)      { moveAtom({x, y}, {x: x, y: y - 1}); }
    });

    return {
        onNewAtom$,
        addAtom,
        canAddAtom,
        explode
    };
};
