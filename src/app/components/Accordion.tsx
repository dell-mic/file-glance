// src/components/Accordion.tsx

import React, { ReactNode } from 'react';

interface AccordionProps {
  header: string;
  subHeader: string;
  open: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
  children: ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ header, subHeader, open, onClick, onPointerDown, children }) => {
  return (
    <div className="border border-gray-300 rounded-md shadow-sm">
      <div
        className="cursor-pointer bg-gray-200 p-1 px-2 flex items-center gap-2"
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <span>{header}</span>
        <span className="text-gray-500 text-sm">{subHeader}</span>
      </div>
      {open && <div className="p-1 px-2 border-t border-gray-300">{children}</div>}
    </div>
  );
};

export default Accordion;
