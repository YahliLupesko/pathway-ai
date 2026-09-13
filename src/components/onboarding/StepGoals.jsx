import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign } from "lucide-react";

export default function StepGoals({ data, setData }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">What are your goals?</h2>
        <p className="text-gray-500 mt-2">Tell us about your college and career aspirations</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Describe your college and career goals
          </Label>
          <Textarea
            placeholder="e.g., I want to become a software engineer and attend a top tech school. I'm interested in starting my own company someday..."
            value={data.goals || ""}
            onChange={(e) => setData({ ...data, goals: e.target.value })}
            className="min-h-[120px] bg-white border-gray-200 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Budget Preference for College
          </Label>
          <RadioGroup
            value={data.budget_range || ""}
            onValueChange={(value) => setData({ ...data, budget_range: value })}
            className="grid grid-cols-2 gap-3"
          >
            {[
              { value: "low", label: "Budget-Friendly", desc: "Under $20k/year" },
              { value: "medium", label: "Moderate", desc: "$20k-$50k/year" },
              { value: "high", label: "Flexible", desc: "$50k+/year" },
              { value: "no_preference", label: "No Preference", desc: "Open to all" }
            ].map((option) => (
              <Label
                key={option.value}
                className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                  data.budget_range === option.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <RadioGroupItem value={option.value} />
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500">{option.desc}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </motion.div>
  );
}