import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Target } from "lucide-react";

export default function YearlyPlanCard({ yearPlan }) {
  return (
    <Card className="border-0 shadow-lg shadow-gray-100 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4">
        <CardTitle className="flex items-center justify-between">
          <span>{yearPlan.grade} Grade</span>
          <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
            {yearPlan.year}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Courses */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Recommended Courses
          </h4>
          <div className="flex flex-wrap gap-2">
            {yearPlan.courses?.map((course, index) => (
              <Badge key={index} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                {course}
              </Badge>
            ))}
          </div>
        </div>

        {/* Activities */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            Activities & Focus Areas
          </h4>
          <ul className="space-y-2">
            {yearPlan.activities?.map((activity, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                {activity}
              </li>
            ))}
          </ul>
        </div>

        {/* Milestones */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-green-600" />
            Key Milestones
          </h4>
          <ul className="space-y-2">
            {yearPlan.milestones?.map((milestone, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                {milestone}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}