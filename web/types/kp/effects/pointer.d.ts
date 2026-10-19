/** @param {import('../effects.js').EffectsContext} ctx */
export declare function install(ctx: import('../effects.js').EffectsContext): {
    pointerLight: () => {
        /** @param {PointerEvent | MouseEvent} event */
        put(event: PointerEvent | MouseEvent): void;
    } | null;
    pointerBus: () => void;
    pressBus: () => void;
};
