"use client";
import { ScrollAreaList } from "@/components/ui/scroll-area";

import * as React from "react";
import { useMorph } from "@/lib/cojeev-motion/use-morph";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Command as Primitive } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  type DialogProps,
} from "@/components/ui/dialog";
import { useFlowGroup } from "@/lib/cojeev-motion/use-flow";
import { adornItem, itemText, type ItemAdornmentItemProps } from "@/components/ui/item-adornment";
import { Icon } from "@/components/ui/icon";
import {
  createMotionLane,
  motionTokens,
  useChoreography,
} from "@/lib/cojeev-motion/choreography";
import { assignMotionRef } from "@/lib/cojeev-motion/refs";

/**
 * cmdk owns filtering and removes its own Item/Empty DOM. Keep that semantic
 * update immediate and coordinate the persistent results paint around it.
 * This is deliberately a results transition, not retained per-item exits.
 */
export function useCommandResultsMotion<T extends HTMLElement>(
  forwardedRef?: React.Ref<T>,
) {
  const { quiet } = useChoreography();
  const quietRef = React.useRef(quiet);
  const settle = React.useRef<(() => void) | null>(null);
  React.useLayoutEffect(() => {
    quietRef.current = quiet;
    if (quiet) settle.current?.();
  }, [quiet]);
  return React.useCallback(
    (node: T | null) => {
      const releaseRef = assignMotionRef(forwardedRef, node);
      if (!node) return releaseRef;
      const lane = createMotionLane(1, (value) =>
        node.style.setProperty("--command-results-opacity", String(value)),
      );
      settle.current = () => lane.jump(1);
      const signature = () =>
        Array.from(node.querySelectorAll("[cmdk-item]"))
          .map((item) => item.id)
          .join("|") +
        ":" +
        Boolean(node.querySelector("[cmdk-empty]"));
      let previous = signature();
      let revision = 0;
      const observer = new MutationObserver(() => {
        const next = signature();
        if (next === previous) return;
        previous = next;
        node.dataset.resultsRevision = String(++revision);
        if (quietRef.current) lane.jump(1);
        else {
          lane.jump(0.86);
          lane.to(1, {
            duration: motionTokens.duration.quick,
            ease: [...motionTokens.ease.enter],
          });
        }
      });
      observer.observe(node, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        settle.current = null;
        lane.dispose();
        node.style.removeProperty("--command-results-opacity");
        releaseRef();
      };
    },
    [forwardedRef],
  );
}
export const commandVariants = cva(
  "v-cmd [background:var(--popover)] [width:min(520px,100%)] [overflow:hidden] [border:0] [box-shadow:var(--shadow-float),inset_0_0_0_1px_var(--v-border)] [border-radius:22px]",
);
export type CommandProps = React.ComponentProps<typeof Primitive>;
export function Command({ className, ref, ...props }: CommandProps) {
  const morphRef = useMorph<HTMLDivElement>("surfaces", ref);
  return (
    <Primitive
      ref={morphRef}
      data-slot="command"
      data-part="root"
      data-command=""
      className={cn(commandVariants(), className)}
      {...props}
    />
  );
}
export type CommandDialogProps = DialogProps & {
  title?: string;
  description?: string;
  className?: string;
};
export function CommandDialog({
  children,
  title = "Command palette",
  description = "Search for a command to run.",
  className,
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command className={className}>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}
export type CommandInputProps = React.ComponentProps<typeof Primitive.Input> & {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};
export function CommandInput({
  className,
  leading,
  trailing,
  ...props
}: CommandInputProps) {
  const wrapperRef = useMorph<HTMLDivElement>("inputs");
  return (
    <div
      ref={wrapperRef}
      data-slot="command-input-wrapper"
      className="v-cmd__input"
    >
      {leading ?? <Icon name="search" />}
      <Primitive.Input
        data-slot="command-input"
        data-part="trigger"
        aria-label="Search commands"
        className={cn(
          "min-w-0 flex-1 bg-transparent [border:0] [outline:0] [padding:1px_2px] text-[length:var(--fs-body)]",
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}
export type CommandListProps = React.ComponentProps<typeof Primitive.List>;
export function CommandList({ className, ref, children, ...props }: CommandListProps) {
  const groupRef = useFlowGroup<HTMLDivElement>(ref, {
    itemSelector: ".v-menu__item",
    activeSelector: "[aria-selected=true]",
  });
  const resultsRef = useCommandResultsMotion(groupRef);
  return (
    <ScrollAreaList>
    <Primitive.List
      ref={resultsRef}
      data-slot="command-list"
      data-part="content"
      className={cn("v-cmd__list v-command-results", className)}
      {...props}
    >{children}</Primitive.List>
    </ScrollAreaList>
  );
}
export type CommandEmptyProps = React.ComponentProps<typeof Primitive.Empty>;
export function CommandEmpty({ className, ...props }: CommandEmptyProps) {
  return (
    <Primitive.Empty
      data-slot="command-empty"
      data-part="empty"
      className={cn("v-cmd__empty", className)}
      {...props}
    />
  );
}
export type CommandGroupProps = React.ComponentProps<typeof Primitive.Group>;
export function CommandGroup({ className, ...props }: CommandGroupProps) {
  return (
    <Primitive.Group
      data-slot="command-group"
      data-part="group"
      className={className}
      {...props}
    />
  );
}
export type CommandItemProps = React.ComponentProps<typeof Primitive.Item> & {
  variant?: "default" | "danger";
} & ItemAdornmentItemProps;
export function CommandItem({
  className,
  adornment,
  adornmentId,
  variant,
  ref,
  children,
  ...props
}: CommandItemProps) {
  const morphRef = useMorph<HTMLDivElement>("nav", ref);
  return (
    <Primitive.Item
      ref={morphRef}
      data-slot="command-item"
      data-part="item"
      data-text-only={
        typeof children === "string" || typeof children === "number"
          ? ""
          : undefined
      }
      className={cn(
        "v-menu__item",
        variant === "danger" && "-danger",
        className,
      )}
      {...props}
    >
      {adornItem(children, adornment, adornmentId ?? props.value ?? itemText(children), props.asChild)}
    </Primitive.Item>
  );
}
export type CommandSeparatorProps = React.ComponentProps<
  typeof Primitive.Separator
>;
export function CommandSeparator({
  className,
  ...props
}: CommandSeparatorProps) {
  return (
    <Primitive.Separator
      data-slot="command-separator"
      data-part="separator"
      className={cn("v-menu__sep", className)}
      {...props}
    />
  );
}
export type CommandShortcutProps = React.ComponentProps<"span">;
export function CommandShortcut({ className, ...props }: CommandShortcutProps) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("v-kbd ml-auto", className)}
      {...props}
    />
  );
}
