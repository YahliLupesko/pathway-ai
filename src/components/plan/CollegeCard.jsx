import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, GraduationCap, ExternalLink } from "lucide-react";

const typeColors = {
  reach: "bg-rose-100 text-rose-700 border-rose-200",
  match: "bg-emerald-100 text-emerald-700 border-emerald-200",
  safety: "bg-blue-100 text-blue-700 border-blue-200"
};

export default function CollegeCard({ college }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(college.name + " admissions")}`;

  return (
    <Card className="border-0 shadow-lg shadow-gray-100 hover:shadow-xl transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{college.name}</h3>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {college.location}
            </div>
          </div>
          <Badge className={`${typeColors[college.type]} border capitalize`}>
            {college.type}
          </Badge>
        </div>

        <p className="text-sm text-gray-600 mb-4">{college.why_good_fit}</p>

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <DollarSign className="w-4 h-4" />
          <span>{college.estimated_cost}</span>
        </div>

        {college.notable_programs?.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <GraduationCap className="w-4 h-4" />
              Notable Programs
            </div>
            <div className="flex flex-wrap gap-1.5">
              {college.notable_programs.map((program, index) => (
                <Badge key={index} variant="outline" className="text-xs bg-gray-50">
                  {program}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Learn More
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}