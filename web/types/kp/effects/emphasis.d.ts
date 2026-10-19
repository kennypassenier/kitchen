/** @param {import('../effects.js').EffectsContext} ctx */
export declare function install(ctx: import('../effects.js').EffectsContext): {
    clearInSteps: (marks: Element[], first: number, step: number, on: Element, routine: string) => void;
    emphasis: (container: Element) => void;
    wireTrigger: (trigger: Element, marks: Element[], container: Element, routine: string) => void;
    looseMarks: (scope: ParentNode) => void;
};
