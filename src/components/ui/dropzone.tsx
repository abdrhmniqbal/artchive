"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.ts";
import { ShapeMorph } from "@/components/ui/shape.tsx";
import { Icon } from "@/components/ui/icon.tsx";
import { MotionPresence, MotionSurface } from "@/components/ui/presence.tsx";

export const dropzoneVariants = cva("v-drop", {
  variants: { variant: { default: "", compact: "-compact" } },
  defaultVariants: { variant: "default" },
});
export type DropzoneFile = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};
export type DropzoneRejection = {
  file: File;
  code: "file-type" | "file-size";
  reason: string;
};
export type DropzoneProps = React.ComponentProps<"div"> &
  VariantProps<typeof dropzoneVariants> & {
    onFilesSelected?: (files: File[]) => void;
    onFilesRejected?: (files: DropzoneRejection[]) => void;
    accept?: string;
    /** Maximum bytes per file. Omit to leave file size unrestricted. */
    maxSize?: number;
    multiple?: boolean;
    disabled?: boolean;
    showReceipt?: boolean;
  };
function fileSize(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function acceptsFile(file: File, accept?: string) {
  if (!accept?.trim()) return true;
  return accept.split(",").some((rule) => {
    const type = rule.trim().toLowerCase();
    return type.startsWith(".")
      ? file.name.toLowerCase().endsWith(type)
      : type.endsWith("/*")
        ? file.type.toLowerCase().startsWith(type.slice(0, -1))
        : file.type.toLowerCase() === type;
  });
}
export function Dropzone({
  className,
  children,
  variant,
  onFilesSelected,
  onFilesRejected,
  accept,
  maxSize,
  multiple = true,
  disabled,
  showReceipt = true,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onKeyDown,
  "aria-describedby": describedBy,
  ...props
}: DropzoneProps) {
  const picker = React.useRef<HTMLInputElement>(null),
    depth = React.useRef(0);
  const id = React.useId();
  const [over, setOver] = React.useState(false);
  const [selected, setSelected] = React.useState<DropzoneFile[]>([]);
  const [rejections, setRejections] = React.useState<DropzoneRejection[]>([]);
  const receive = (files: File[]) => {
    const chosen = multiple ? files : files.slice(0, 1),
      accepted: File[] = [],
      rejected: DropzoneRejection[] = [];
    for (const file of chosen) {
      if (!acceptsFile(file, accept))
        rejected.push({
          file,
          code: "file-type",
          reason: "This file type is not accepted.",
        });
      else if (
        maxSize !== undefined &&
        Number.isFinite(maxSize) &&
        maxSize >= 0 &&
        file.size > maxSize
      )
        rejected.push({
          file,
          code: "file-size",
          reason: `Choose a file smaller than ${fileSize(maxSize)}.`,
        });
      else accepted.push(file);
    }
    setSelected(
      accepted.map(({ name, size, type, lastModified }) => ({
        name,
        size,
        type,
        lastModified,
      })),
    );
    setRejections(rejected);
    onFilesSelected?.(accepted);
    if (rejected.length) onFilesRejected?.(rejected);
  };
  const state = disabled
    ? "disabled"
    : over
      ? "over"
      : rejections.length
        ? "error"
        : selected.length
          ? "selected"
          : "rest";
  return (
    <div
      data-slot="dropzone"
      data-part="root"
      data-drop=""
      data-state={state}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label="Add files"
      aria-describedby={[
        `${id}-help`,
        showReceipt && selected.length ? `${id}-receipt` : null,
        rejections.length ? `${id}-error` : null,
        describedBy,
      ]
        .filter(Boolean)
        .join(" ")}
      className={cn(dropzoneVariants({ variant }), className)}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          !disabled &&
          event.target !== picker.current
        )
          picker.current?.click();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          !disabled &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          picker.current?.click();
        }
      }}
      onDragEnter={(event) => {
        onDragEnter?.(event);
        const cancelled = event.defaultPrevented;
        event.preventDefault();
        if (!cancelled && !disabled && ++depth.current > 0) setOver(true);
      }}
      onDragOver={(event) => {
        onDragOver?.(event);
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        onDragLeave?.(event);
        event.preventDefault();
        if (--depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(event) => {
        onDrop?.(event);
        const cancelled = event.defaultPrevented;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (!cancelled && !disabled)
          receive(Array.from(event.dataTransfer.files));
      }}
      {...props}
    >
      <input
        ref={picker}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
        onChange={(event) => {
          receive(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {children ?? (
        <>
          <span data-slot="dropzone-art" aria-hidden="true">
            <ShapeMorph name="pebble-soft" className="v-drop__pebble" />
            <ShapeMorph name="daisy-12" className="v-drop__flower" />
            <span data-slot="dropzone-symbol">
              <Icon name={selected.length ? "check" : "upload"} />
            </span>
          </span>
          <span data-slot="dropzone-copy">
            <b>
              {over
                ? "Let them land here"
                : selected.length
                  ? "Ready when you are"
                  : "A place for your files"}
            </b>
            <span>
              {over
                ? "Release to add your files"
                : "Drop files here, or choose from your device."}
            </span>
          </span>
          <span data-slot="dropzone-action">
            {selected.length ? "Choose files again" : "Choose files"}
            <Icon name="arrow-up-right" />
          </span>
        </>
      )}
      <span id={`${id}-help`} data-slot="dropzone-help">
        {accept
          ? `Accepts ${accept
              .split(",")
              .map((type) => type.trim())
              .join(", ")}.`
          : "Any file type."}
        {maxSize !== undefined && Number.isFinite(maxSize) && maxSize >= 0
          ? ` Up to ${fileSize(maxSize)} per file.`
          : ""}
        {!multiple ? " One file at a time." : ""}
      </span>
      <MotionPresence>
        {showReceipt && selected.length > 0 && (
          <MotionSurface key="receipt" asChild preset="fade">
            <div
              id={`${id}-receipt`}
              data-slot="dropzone-receipt"
              data-drop-result=""
              role="status"
            >
              <b>
                {selected.length} file{selected.length === 1 ? "" : "s"}{" "}
                selected
              </b>
              {selected.slice(0, 3).map((file, index) => (
                <span data-slot="dropzone-file" key={`${file.name}-${index}`}>
                  <Icon name="file" />
                  <span title={file.name}>{file.name}</span>
                  <small>{fileSize(file.size)}</small>
                </span>
              ))}
              {selected.length > 3 && (
                <small>And {selected.length - 3} more.</small>
              )}
            </div>
          </MotionSurface>
        )}
        {rejections.length > 0 && (
          <MotionSurface key="error" asChild preset="fade">
            <p id={`${id}-error`} data-slot="dropzone-error" role="alert">
              <b>
                {rejections.length === 1
                  ? rejections[0].file.name
                  : `${rejections.length} files`}{" "}
                couldn’t be added.
              </b>{" "}
              {rejections[0].reason}
            </p>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
