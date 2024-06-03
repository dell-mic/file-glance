// src/components/Accordion.tsx

import React, { ReactNode } from 'react';

interface AccordionProps {
  header: string;
  subHeader: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ header, subHeader, open, onClick, children }) => {
  return (
    <div className="border border-gray-300 rounded-md shadow-sm">
      <div
        className="cursor-pointer bg-gray-200 p-1 px-2 flex items-center gap-2"
        onClick={onClick}
      >
        <span>{header}</span>
        <span className="text-gray-500 text-sm">{subHeader}</span>
      </div>
      {open && <div className="p-1 px-2 border-t border-gray-300">{children}</div>}
    </div>
  );
};

export default Accordion;
