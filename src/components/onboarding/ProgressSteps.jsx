import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function ProgressSteps({ currentStep, totalSteps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ 
              scale: currentStep === i + 1 ? 1.1 : 1,
              backgroundColor: i + 1 <= currentStep ? "#4F46E5" : "#E5E7EB"
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
          >
            {i + 1 < currentStep ? (
              <Check className="w-5 h-5 text-white" />
            ) : (
              <span className={i + 1 <= currentStep ? "text-white" : "text-gray-500"}>
                {i + 1}
              </span>
            )}
          </motion.div>
          {i < totalSteps - 1 && (
            <div 
              className={`w-12 h-1 mx-1 rounded-full transition-colors duration-300 ${
                i + 1 < currentStep ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}