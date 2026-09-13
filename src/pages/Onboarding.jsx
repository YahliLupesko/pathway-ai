import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

import ProgressSteps from "@/components/onboarding/ProgressSteps";
import StepBasicInfo from "@/components/onboarding/StepBasicInfo";
import StepInterests from "@/components/onboarding/StepInterests";
import StepGoals from "@/components/onboarding/StepGoals";
import StepExtras from "@/components/onboarding/StepExtras";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    grade_level: "",
    gpa: "",
    location_preference: "",
    school_name: "",
    district: "",
    school_type: "",
    interests: [],
    goals: "",
    budget_range: "",
    extracurriculars: [],
    test_scores: {}
  });

  const totalSteps = 4;

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.grade_level && formData.gpa && formData.school_name && formData.district;
      case 2:
        return formData.interests.length > 0;
      case 3:
        return formData.goals && formData.budget_range;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const profileData = {
      ...formData,
      onboarding_complete: true,
      conversation_history: [],
      plan_generated: false
    };

    await base44.entities.StudentProfile.create(profileData);
    window.location.href = createPageUrl("AIConversation");
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepBasicInfo data={formData} setData={setFormData} />;
      case 2:
        return <StepInterests data={formData} setData={setFormData} />;
      case 3:
        return <StepGoals data={formData} setData={setFormData} />;
      case 4:
        return <StepExtras data={formData} setData={setFormData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <Sparkles className="w-4 h-4" />
            AI-Powered College Planning
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-bold text-gray-900"
          >
            Your Path to College
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 mt-2"
          >
            Let's create a personalized plan just for you
          </motion.p>
        </div>

        {/* Progress */}
        <ProgressSteps currentStep={step} totalSteps={totalSteps} />

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8"
        >
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              className="text-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {step < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating your plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start AI Conversation
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Your information is secure and will only be used to generate your personalized college plan.
        </p>
      </div>
    </div>
  );
}