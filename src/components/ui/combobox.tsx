"use client";
import { ScrollAreaList } from "@/components/ui/scroll-area";

import * as React from "react";
import { useMorph } from "@/lib/cojeev-motion/use-morph";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Command as Primitive } from "cmdk";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { InputWrapper, InputControl } from "@/components/ui/input";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { Icon, Disk } from "@/components/ui/icon";
import { useCommandResultsMotion } from "@/components/ui/command";
import {
  useFlowAppearance,
  useFlowGroup,
} from "@/lib/cojeev-motion/use-flow";
import { ItemAdornment, itemText, menuAdornment, type ItemAdornmentItemProps, type ItemAdornmentValue } from "@/components/ui/item-adornment";
export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
  adornment?: ItemAdornmentValue;
};
type ComboboxState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  selected: string;
  select: (value: string, label: string) => void;
  query: string;
  setQuery: (value: string) => void;
  listId: string;
};
const ComboboxContext = React.createContext<ComboboxState | null>(null);
const ComboboxInputRefContext = React.createContext<
  React.RefCallback<HTMLInputElement> | undefined
>(undefined);
function useCombobox() {
  const context = React.useContext(ComboboxContext);
  if (!context) throw new Error("Combobox parts must be inside Combobox");
  return context;
}
export const comboboxVariants = cva("v-combo [position:relative]");
export type ComboboxProps = Omit<
  React.ComponentProps<typeof Primitive>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  options?: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  "aria-label"?: string;
};
export function Combobox({
  className,
  children,
  value,
  defaultValue = "",
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  options,
  placeholder,
  emptyText = "No matches",
  ...props
}: ComboboxProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const selected = value ?? internalValue;
  const selectedLabel =
    options?.find((option) => option.value === selected)?.label ?? selected;
  const selectionKey = JSON.stringify([selected, selectedLabel]);
  const [search, setSearch] = React.useState({
    selection: selectionKey,
    query: selectedLabel,
  });
  const query =
    search.selection === selectionKey ? search.query : selectedLabel;
  const setQuery = (next: string) =>
    setSearch({ selection: selectionKey, query: next });
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const registerInput = React.useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
  }, []);
  const isOpen = open ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const select = (next: string, label: string) => {
    setInternalValue(next);
    onValueChange?.(next);
    setSearch({
      selection: JSON.stringify([
        next,
        options?.find((option) => option.value === next)?.label ?? next,
      ]),
      query: label,
    });
    setOpen(false);
    inputRef.current?.focus();
  };
  return (
    <ComboboxContext.Provider
      value={{
        open: isOpen,
        setOpen,
        selected,
        select,
        query,
        setQuery,
        listId,
      }}
    >
      <ComboboxInputRefContext.Provider value={registerInput}>
        <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
          <Primitive
            data-slot="combobox"
            data-part="root"
            data-combo=""
            data-state={isOpen ? "open" : "closed"}
            className={cn(comboboxVariants(), className)}
            {...props}
          >
            {children ?? (
              <>
                <ComboboxInput
                  placeholder={placeholder}
                  aria-label={props["aria-label"] ?? "Choose an option"}
                />
                <ComboboxContent>
                  <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                  {options?.map((option) => (
                    <ComboboxItem
                      key={option.value}
                      value={option.value}
                      label={option.label}
                      disabled={option.disabled}
                      adornment={option.adornment}
                    >
                      {option.label}
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </>
            )}
          </Primitive>
        </PopoverPrimitive.Root>
      </ComboboxInputRefContext.Provider>
    </ComboboxContext.Provider>
  );
}
export type ComboboxInputProps = React.ComponentProps<
  typeof Primitive.Input
> & {
  wrapperProps?: React.ComponentProps<typeof InputWrapper>;
  leading?: React.ReactNode;
};
export function ComboboxInput({
  className,
  wrapperProps,
  leading,
  onValueChange,
  onFocus,
  onKeyDown,
  ...props
}: ComboboxInputProps) {
  const state = useCombobox();
  const inputRef = React.useContext(ComboboxInputRefContext);
  return (
    <PopoverPrimitive.Anchor asChild>
      <InputWrapper {...wrapperProps}>
        {leading ?? (
          <Disk size="sm">
            <Icon name="search" />
          </Disk>
        )}
        <Primitive.Input
          ref={inputRef}
          asChild
          value={state.query}
          onValueChange={(next) => {
            state.setQuery(next);
            state.setOpen(true);
            onValueChange?.(next);
          }}
        >
          <InputControl
            data-slot="combobox-input"
            data-part="trigger"
            className={className}
            aria-expanded={state.open}
            aria-controls={state.listId}
            onFocus={(event: React.FocusEvent<HTMLInputElement>) => {
              state.setOpen(true);
              onFocus?.(event);
            }}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              onKeyDown?.(event);
              if (event.defaultPrevented) return;
              if (event.key === "Escape") {
                event.preventDefault();
                state.setOpen(false);
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp")
                state.setOpen(true);
            }}
            {...props}
          />
        </Primitive.Input>
      </InputWrapper>
    </PopoverPrimitive.Anchor>
  );
}
export type ComboboxContentProps = React.ComponentProps<typeof Primitive.List>;
export function ComboboxContent({
  className,
  children,
  ref,
  style,
  ...props
}: ComboboxContentProps) {
  const morphRef = useMorph<HTMLDivElement>("surfaces");
  const state = useCombobox();
  const groupRef = useFlowGroup<HTMLDivElement>(morphRef, {
    itemSelector: ".v-menu__item",
    activeSelector: "[aria-selected=true]",
  });
  const flowRef = useFlowAppearance<HTMLDivElement>(
    state.open,
    groupRef,
    "grow",
  );
  const resultsRef = useCommandResultsMotion(ref);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={flowRef}
        data-slot="combobox-content"
        data-part="content"
        className={cn("v-menu", className)}
        style={style}
        sideOffset={6}
        collisionPadding={12}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-slot="combobox"]')
          )
            event.preventDefault();
        }}
      >
        <ScrollAreaList maxHeight="min(280px, calc(var(--radix-popover-content-available-height, 60dvh) - 20px))">
        <Primitive.List
          ref={resultsRef}
          id={state.listId}
          data-slot="combobox-list"
          data-part="content"
          className="v-command-results"
          {...props}
        >{children}</Primitive.List>
        </ScrollAreaList>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
export const ComboboxList = ComboboxContent;
export type ComboboxItemProps = React.ComponentProps<typeof Primitive.Item> & {
  label?: string;
  showIndicator?: boolean;
} & ItemAdornmentItemProps;
export function ComboboxItem({
  showIndicator = false,
  className,
  adornment,
  adornmentId,
  children,
  onSelect,
  label,
  value,
  ref,
  ...props
}: ComboboxItemProps) {
  const morphRef = useMorph<HTMLDivElement>("nav", ref);
  const state = useCombobox();
  return (
    <Primitive.Item
      ref={morphRef}
      data-slot="combobox-item"
      data-selected-option={state.selected === value || undefined}
      data-part="item"
      className={cn("v-menu__item", className)}
      value={value}
      keywords={label ? [label] : undefined}
      onSelect={(next) => {
        state.select(
          value ?? next,
          label ?? (typeof children === "string" ? children : next),
        );
        onSelect?.(next);
      }}
      {...props}
    >
      <ItemAdornment identity={adornmentId ?? value ?? label ?? itemText(children)} value={menuAdornment(adornment)} />
      <span className="v-combo__label">{children}</span>
      {showIndicator && state.selected === value && <span className="v-combo__selected" aria-hidden="true"><AnimatedIcon name="check" preset="validation" /></span>}
    </Primitive.Item>
  );
}
export type ComboboxEmptyProps = React.ComponentProps<typeof Primitive.Empty>;
export function ComboboxEmpty({ className, ...props }: ComboboxEmptyProps) {
  return (
    <Primitive.Empty
      data-slot="combobox-empty"
      data-part="empty"
      className={cn("p-3 text-[color:var(--v-text-2)]", className)}
      {...props}
    />
  );
}
export type ComboboxGroupProps = React.ComponentProps<typeof Primitive.Group>;
export function ComboboxGroup(props: ComboboxGroupProps) {
  return (
    <Primitive.Group data-slot="combobox-group" data-part="group" {...props} />
  );
}
