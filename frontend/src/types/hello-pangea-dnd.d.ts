declare module '@hello-pangea/dnd' {
    import * as React from 'react';

    export type DraggableId = string;
    export type DroppableId = string;
    export type DragReason = 'DROP' | 'CANCEL';
    export type DragMode = 'FLUID' | 'SNAP';

    export interface DraggableLocation {
        droppableId: DroppableId;
        index: number;
    }

    export interface DragStart {
        draggableId: DraggableId;
        type: string;
        source: DraggableLocation;
        mode: DragMode;
    }

    export interface DragUpdate extends DragStart {
        destination?: DraggableLocation | null;
        combine?: Combine | null;
    }

    export interface Combine {
        draggableId: DraggableId;
        droppableId: DroppableId;
    }

    export interface DropResult {
        draggableId: DraggableId;
        type: string;
        source: DraggableLocation;
        destination: DraggableLocation | null;
        reason: DragReason;
        mode: DragMode;
        combine?: Combine | null;
    }

    export interface DraggableProvided {
        innerRef: (element: HTMLElement | null) => void;
        draggableProps: {
            'data-rbd-draggable-context-id': string;
            'data-rbd-draggable-id': string;
            style?: React.CSSProperties;
        };
        dragHandleProps: {
            'data-rbd-drag-handle-draggable-id': string;
            'data-rbd-drag-handle-context-id': string;
            'aria-describedby': string;
            role: string;
            tabIndex: number;
            draggable: boolean;
        } | null;
    }

    export interface DroppableProvided {
        innerRef: (element: HTMLElement | null) => void;
        placeholder?: React.ReactNode;
        droppableProps: {
            'data-rbd-droppable-context-id': string;
            'data-rbd-droppable-id': string;
        };
    }

    export interface DragDropContextProps {
        onDragEnd: (result: DropResult) => void;
        onDragStart?: (initial: DragStart) => void;
        children?: React.ReactNode;
    }

    export interface DroppableProps {
        droppableId: string;
        type?: string;
        children: (provided: DroppableProvided) => React.ReactNode;
    }

    export interface DraggableProps {
        draggableId: string;
        index: number;
        children: (provided: DraggableProvided) => React.ReactNode;
    }

    export class DragDropContext extends React.Component<DragDropContextProps> {}
    export class Droppable extends React.Component<DroppableProps> {}
    export class Draggable extends React.Component<DraggableProps> {}
} 