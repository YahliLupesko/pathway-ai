import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, Calendar, DollarSign, ExternalLink } from "lucide-react";

export default function SummerProgramsList({ programs }) {
  return (
    <Card className="border-0 shadow-lg shadow-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          Summer Programs to Consider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {programs?.map((program, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100"
          >
            <h4 className="font-semibold text-gray-900 mb-2">{program.name}</h4>
            <p className="text-sm text-gray-600 mb-3">{program.description}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <Badge variant="outline" className="bg-white">
                <Calendar className="w-3 h-3 mr-1" />
                {program.timing}
              </Badge>
              <Badge variant="outline" className="bg-white">
                <DollarSign className="w-3 h-3 mr-1" />
                {program.cost}
              </Badge>
            </div>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(program.name + " summer program")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-3"
            >
              Search for more info
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}