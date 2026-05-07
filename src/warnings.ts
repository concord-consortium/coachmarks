export const warnings = {
  postDestroy: (method: string) =>
    `${method}() called after destroy(); ignored.`,
  refreshNoActive: () => "refresh() called with no active step; ignored.",
  moveToOutOfBounds: (idx: number, max: number) =>
    `moveTo(${idx}) out of bounds [0, ${max}); ignored.`,
  moveToNoActive: () =>
    "moveTo() called with no active drive() sequence; ignored.",
  dismissPopoverNoActive: () =>
    "dismissPopover() called with no active step; ignored.",
  dismissPopoverGroupMode: (idx: number) =>
    `dismissPopover(${idx}) under dismissBehavior "group" is ignored — use the close button or onCancelRequested.`,
  dismissPopoverBareOutOfBounds: (idx: number) =>
    `dismissPopover(${idx}) on a bare-popover step is out of bounds; ignored.`,
  dismissPopoverOutOfBounds: (idx: number, max: number) =>
    `dismissPopover(${idx}) out of bounds [0, ${max}); ignored.`,
  companionDropped: (idx: number) =>
    `PopoverGroup companion at index ${idx} has no layout box; silently dropping.`,
  emptyPopovers: () =>
    "PopoverGroup with empty `popovers` array; ignored. (TypeScript requires at least one popover; this guard catches JS callers.)",
  elementPositionCollision: (where: string) =>
    `${where} has both \`element\` and \`popover.position\`; \`element\` wins, \`position\` ignored.`,
  titleHeadingLevelInvalid: (got: unknown) =>
    `titleHeadingLevel must be an integer 1–6; got ${got}; falling back to 2.`,
};
