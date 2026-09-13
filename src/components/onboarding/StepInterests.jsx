import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState } from "react";

const SUGGESTED_INTERESTS = [
  "Computer Science", "Engineering", "Medicine", "Business", "Art & Design",
  "Music", "Writing", "Mathematics", "Biology", "Psychology", "Law",
  "Environmental Science", "Film & Media", "History", "Political Science",
  "Economics", "Chemistry", "Physics", "Nursing", "Architecture"
];

export default function StepInterests({ data, setData }) {
  const [customInterest, setCustomInterest] = useState("");
  const interests = data.interests || [];

  const toggleInterest = (interest) => {
    if (interests.includes(interest)) {
      setData({ ...data, interests: interests.filter(i => i !== interest) });
    } else {
      setData({ ...data, interests: [...interests, interest] });
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setData({ ...data, interests: [...interests, customInterest.trim()] });
      setCustomInterest("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">What are you passionate about?</h2>
        <p className="text-gray-500 mt-2">Select your academic and career interests</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTED_INTERESTS.map((interest) => (
          <Badge
            key={interest}
            variant={interests.includes(interest) ? "default" : "outline"}
            className={`cursor-pointer py-2 px-4 text-sm transition-all ${
              interests.includes(interest)
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "hover:bg-indigo-50 hover:border-indigo-300"
            }`}
            onClick={() => toggleInterest(interest)}
          >
            {interest}
            {interests.includes(interest) && <X className="w-3 h-3 ml-1" />}
          </Badge>
        ))}
      </div>

      <div className="flex gap-2 mt-6">
        <Input
          placeholder="Add a custom interest..."
          value={customInterest}
          onChange={(e) => setCustomInterest(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addCustomInterest()}
          className="h-12 bg-white border-gray-200"
        />
        <Button onClick={addCustomInterest} className="h-12 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {interests.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          {interests.length} interest{interests.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </motion.div>
  );
}