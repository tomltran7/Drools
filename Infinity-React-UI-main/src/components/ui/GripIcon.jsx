import React from "react";

export function GripIcon({ className = "", ...props }) {
  // SVG grip dots for drag handle
  return (
    <svg width="16" height="32" viewBox="0 0 16 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="8" cy="6" r="1.5" fill="#888" />
      <circle cx="8" cy="12" r="1.5" fill="#888" />
      <circle cx="8" cy="18" r="1.5" fill="#888" />
      <circle cx="8" cy="24" r="1.5" fill="#888" />
    </svg>
  );
}
