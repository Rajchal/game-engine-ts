import { Dir, TileType } from "./constants";

export interface Controls {
    urlInput: HTMLInputElement;
    nameInput: HTMLInputElement;
    connectBtn: HTMLButtonElement;
    status: HTMLElement;
    overlay: HTMLElement;
    canvas: HTMLCanvasElement;
    minimap: HTMLCanvasElement;
    stateGrid: HTMLElement;
}

export interface DragonState {
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
}

export interface PlayerState {
    x: number;
    y: number;
    hp: number;
    inv: string[];
    dir: Dir;
}

export interface OpponentState {
    x: number;
    y: number;
    hp: number;
    invCount: number;
    dir: Dir;
}

export interface AnimState {
    dir: Dir;
    moving: boolean;
    elapsed: number;
}

export interface GameState {
    world: TileType[][] | null;
    you: PlayerState;
    opp: OpponentState;
    renderYou: { x: number; y: number };
    renderOpp: { x: number; y: number };
    dragon: DragonState | null;
    minimapBase: HTMLCanvasElement | null;
    anim: {
        you: AnimState;
        opp: AnimState;
    };
    prev:
    | {
        you: { x: number; y: number };
        opp: { x: number; y: number };
    }
    | null;
}

export interface ServerMatchStart {
    type: "MatchStart";
    seed: number;
    world_width: number;
    world_height: number;
    spawn_x: number;
    spawn_y: number;
    opponent_name: string;
    tiles?: string;
}

export interface ServerStateUpdate {
    type: "StateUpdate";
    your_x: number;
    your_y: number;
    your_hp: number;
    your_inventory: string[];
    opponent_x: number;
    opponent_y: number;
    opponent_hp: number;
    opponent_item_count: number;
    dragon_visible: boolean;
    dragon_x: number | null;
    dragon_y: number | null;
    dragon_width: number | null;
    dragon_height: number | null;
    dragon_hp: number | null;
}

export interface ServerDragonRevealed {
    type: "DragonRevealed";
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ServerAttackResult {
    type: "AttackResult";
    damage_dealt: number;
    damage_taken: number;
    your_hp: number;
    dragon_hp: number;
}

export interface ServerMoveDenied {
    type: "MoveDenied";
    reason: string;
}

export interface ServerItemPickedUp {
    type: "ItemPickedUp";
    item: string;
}

export interface ServerMatchEnd {
    type: "MatchEnd";
    winner: string;
}

export interface ServerErrorMsg {
    type: "Error";
    message: string;
}

export interface ServerWelcome {
    type: "Welcome";
    player_id: string;
}

export interface ServerWaiting {
    type: "WaitingForOpponent";
}

export interface ServerOpponentDisconnected {
    type: "OpponentDisconnected";
}

export type ServerMessage =
    | ServerWelcome
    | ServerWaiting
    | ServerMatchStart
    | ServerStateUpdate
    | ServerDragonRevealed
    | ServerAttackResult
    | ServerMoveDenied
    | ServerItemPickedUp
    | ServerMatchEnd
    | ServerOpponentDisconnected
    | ServerErrorMsg
    | { type: string;[k: string]: unknown };
