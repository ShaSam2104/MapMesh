import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface InspectorDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function InspectorDrawer({
  open,
  title,
  onClose,
  children,
}: InspectorDrawerProps): JSX.Element {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label={title}
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 right-0 h-full w-[360px] bg-bg-1 border-l border-line shadow-none flex flex-col"
        >
          <div className="h-14 flex items-center justify-between border-b border-line px-4">
            <span className="label">{title}</span>
            <button
              type="button"
              aria-label="Close inspector"
              className="focus-ring p-1 text-ink-1 hover:text-ink-0"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
