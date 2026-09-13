import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, AlertTriangle } from "lucide-react";

export default function RestartConfirmDialog({ isOpen, onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="pt-10 pb-6 px-8 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30"
              >
                <RotateCcw className="w-8 h-8 text-white" />
              </motion.div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Restart your plan?
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                This will clear your current plan and profile so you can start fresh. This can't be undone.
              </p>
            </div>

            {/* Buttons */}
            <div className="px-8 pb-8 flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
              >
                Keep my plan
              </Button>
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex-1"
              >
                <Button
                  onClick={onConfirm}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-orange-500/30"
                >
                  Start over
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}