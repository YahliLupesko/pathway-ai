import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X, Trophy, Music, Users, BookOpen } from "lucide-react";
import { useState } from "react";

const SUGGESTED_ACTIVITIES = [
  "Sports Team", "Student Government", "Debate Club", "Volunteer Work",
  "Music/Band", "Drama/Theater", "Science Club", "Math Team",
  "Art Club", "Newspaper/Yearbook", "Robotics", "Model UN",
  "Environmental Club", "Part-time Job", "Tutoring", "Church Group"
];

export default function StepExtras({ data, setData }) {
  const [customActivity, setCustomActivity] = useState("");
  const [satScore, setSatScore] = useState(data.test_scores?.sat || "");
  const [actScore, setActScore] = useState(data.test_scores?.act || "");
  const activities = data.extracurriculars || [];

  const toggleActivity = (activity) => {
    if (activities.includes(activity)) {
      setData({ ...data, extracurriculars: activities.filter(a => a !== activity) });
    } else {
      setData({ ...data, extracurriculars: [...activities, activity] });
    }
  };

  const addCustomActivity = () => {
    if (customActivity.trim() && !activities.includes(customActivity.trim())) {
      setData({ ...data, extracurriculars: [...activities, customActivity.trim()] });
      setCustomActivity("");
    }
  };

  const updateTestScores = (type, value) => {
    const scores = { ...data.test_scores };
    if (value) {
      scores[type] = parseInt(value);
    } else {
      delete scores[type];
    }
    setData({ ...data, test_scores: scores });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Almost there!</h2>
        <p className="text-gray-500 mt-2">Tell us about your activities and test scores (optional)</p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4" />
            Current Extracurricular Activities
          </Label>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_ACTIVITIES.map((activity) => (
              <Badge
                key={activity}
                variant={activities.includes(activity) ? "default" : "outline"}
                className={`cursor-pointer py-1.5 px-3 text-xs transition-all ${
                  activities.includes(activity)
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "hover:bg-indigo-50 hover:border-indigo-300"
                }`}
                onClick={() => toggleActivity(activity)}
              >
                {activity}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input
              placeholder="Add another activity..."
              value={customActivity}
              onChange={(e) => setCustomActivity(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addCustomActivity()}
              className="h-10 bg-white border-gray-200 text-sm"
            />
            <Button onClick={addCustomActivity} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">SAT Score (optional)</Label>
            <Input
              type="number"
              min="400"
              max="1600"
              placeholder="e.g., 1200"
              value={satScore}
              onChange={(e) => {
                setSatScore(e.target.value);
                updateTestScores("sat", e.target.value);
              }}
              className="h-11 bg-white border-gray-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">ACT Score (optional)</Label>
            <Input
              type="number"
              min="1"
              max="36"
              placeholder="e.g., 28"
              value={actScore}
              onChange={(e) => {
                setActScore(e.target.value);
                updateTestScores("act", e.target.value);
              }}
              className="h-11 bg-white border-gray-200"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}