import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

const priorityConfig = {
  high: { color: "bg-rose-100 text-rose-700", icon: AlertCircle },
  medium: { color: "bg-amber-100 text-amber-700", icon: Clock },
  low: { color: "bg-blue-100 text-blue-700", icon: Circle }
};

export default function ActionItemsList({ actions }) {
  const [completed, setCompleted] = useState({});

  const toggleComplete = (index) => {
    setCompleted(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Card className="border-0 shadow-lg shadow-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Next Steps (Next 3 Months)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions?.map((action, index) => {
          const PriorityIcon = priorityConfig[action.priority]?.icon || Circle;
          
          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                completed[index]
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <Checkbox
                checked={completed[index]}
                onCheckedChange={() => toggleComplete(index)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className={`text-sm ${completed[index] ? "line-through text-gray-400" : "text-gray-700"}`}>
                  {action.action}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-xs ${priorityConfig[action.priority]?.color}`}>
                    <PriorityIcon className="w-3 h-3 mr-1" />
                    {action.priority}
                  </Badge>
                  <span className="text-xs text-gray-400">{action.deadline}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}