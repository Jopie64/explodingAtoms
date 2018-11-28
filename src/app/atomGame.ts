import { Observable, Subject, empty, BehaviorSubject } from 'rxjs';

export interface AtomPos {
    x: number;
    y: number;
}

export interface Atom {
    player: number;
    pos$: Observable<AtomPos>;
}

export interface AtomGame {
    onNewAtom$: Observable<Atom>;
    addAtom(pos: AtomPos): Atom;
}

interface InternalAtom {
    player: number;
    pos$: BehaviorSubject<AtomPos>;
}

export const makeAtomGame = (sx: number, sy: number): AtomGame => {
    const onNewAtom$ = new Subject<Atom>();
    let player = 0;

    const toIx = ({x, y}: AtomPos) => y * sx + x;
    const field: InternalAtom[][] = [];
    // for (let y = 0; y < sy; ++y) {
    //     for (let x = 0; x < sx; ++x) {
    //     }
    // }

    // Initialize empty cells
    for (let i = 0; i < sx * sy; ++i) {
        field.push([]);
    }

    const addAtom = (pos: AtomPos): Atom => {
        const newAtom = {
            player,
            pos$: new BehaviorSubject<AtomPos>(pos)
        };
        const cel = field[toIx(pos)];
        cel.push(newAtom);
        onNewAtom$.next(newAtom);
        ++player;
        player %= 2;
        return newAtom;
    };

    return {
        onNewAtom$,
        addAtom
    };
};
